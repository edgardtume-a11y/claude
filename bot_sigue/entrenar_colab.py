"""
Fine-tuning LoRA del clasificador. Pensado para Google Colab (T4, gratis).

    !pip install -q unsloth
    !python3 bot_sigue/entrenar_colab.py datos/pares.jsonl

NO se ha ejecutado en el entorno donde se escribió (sin GPU ni unsloth):
sigue el patrón documentado de Unsloth, pero verifica el nombre del modelo
base en huggingface.co/unsloth antes de lanzarlo.

Qué hace:
  1. Lee el JSONL y se queda con las filas etiquetadas (estado != "").
  2. Las convierte al MISMO formato de chat que usa el clasificador:
     system + entrada → JSON de salida. Así el modelo aprende exactamente
     lo que el supervisor le va a pedir en producción.
  3. Aparta un 10 % para validar.
  4. Entrena un LoRA (QLoRA, 4 bits) sobre el modelo base.
  5. Exporta a GGUF Q4_K_M y escribe un Modelfile para Ollama.

Entrenar es algo que haces una vez; inferir, cada minuto. Entrena aquí,
ejecuta en tu 3050.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

# Permite ejecutarlo como archivo suelto desde la raíz del repo en Colab.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot_sigue import config  # noqa: E402
from bot_sigue.clasificador import ESTADOS, SISTEMA  # noqa: E402


def cargar(ruta: Path) -> list[dict]:
    filas = []
    with ruta.open(encoding="utf-8") as f:
        for linea in f:
            if not linea.strip():
                continue
            fila = json.loads(linea)
            if fila.get("estado") in ESTADOS and fila.get("entrada"):
                filas.append(fila)
    return filas


def a_mensajes(fila: dict) -> list[dict[str, str]]:
    """Mismo formato que construye clasificador._construir_mensajes."""
    salida = {
        "estado": fila["estado"],
        "confianza": 0.9,
        "motivo": fila.get("motivo", ""),
        "mensaje": "" if fila["estado"] in ("terminado", "bucle") else fila.get("salida", ""),
    }
    return [
        {"role": "system", "content": SISTEMA.format(
            nombre=config.NOMBRE, preferencias=config.PREFERENCIAS)},
        {"role": "user", "content": f"ÚLTIMO mensaje del asistente:\n{fila['entrada']}"},
        {"role": "assistant", "content": json.dumps(salida, ensure_ascii=False)},
    ]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Entrena un LoRA del clasificador.")
    ap.add_argument("jsonl", type=Path)
    ap.add_argument("--modelo-base", default="unsloth/Qwen3-4B",
                    help="verifica el nombre exacto en huggingface.co/unsloth")
    ap.add_argument("--salida", type=Path, default=Path("lora_supervisor"))
    ap.add_argument("--epochs", type=int, default=2, help="3 máximo con pocos datos")
    ap.add_argument("--rank", type=int, default=16)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--seq", type=int, default=1024)
    ap.add_argument("--semilla", type=int, default=7)
    args = ap.parse_args(argv)

    filas = cargar(args.jsonl)
    if len(filas) < 100:
        print(f"Solo {len(filas)} filas etiquetadas. Por debajo de ~500 el LoRA "
              f"rara vez supera al modelo base; con menos de 100 no merece la pena. "
              f"Sigue con few-shot en config.EJEMPLOS.", file=sys.stderr)
        if len(filas) < 20:
            return 2

    random.seed(args.semilla)
    random.shuffle(filas)
    corte = max(1, len(filas) // 10)
    valid, train = filas[:corte], filas[corte:]
    print(f"{len(train)} para entrenar, {len(valid)} para validar")

    # --- a partir de aquí hace falta GPU y unsloth ---------------------
    try:
        from unsloth import FastLanguageModel
        from datasets import Dataset
        from trl import SFTTrainer, SFTConfig
    except ImportError as e:
        print(f"Falta una dependencia ({e.name}). En Colab:  !pip install -q unsloth",
              file=sys.stderr)
        return 2

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.modelo_base,
        max_seq_length=args.seq,
        load_in_4bit=True,
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.rank,
        lora_alpha=args.rank * 2,
        lora_dropout=0,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        use_gradient_checkpointing="unsloth",
        random_state=args.semilla,
    )

    def formatear(lote):
        textos = [
            tokenizer.apply_chat_template(a_mensajes(f), tokenize=False)
            for f in lote["fila"]
        ]
        return {"text": textos}

    ds_train = Dataset.from_dict({"fila": train}).map(formatear, batched=True)
    ds_valid = Dataset.from_dict({"fila": valid}).map(formatear, batched=True)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=ds_train,
        eval_dataset=ds_valid,
        args=SFTConfig(
            output_dir=str(args.salida / "checkpoints"),
            dataset_text_field="text",
            max_seq_length=args.seq,
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            num_train_epochs=args.epochs,
            learning_rate=args.lr,
            warmup_ratio=0.05,
            lr_scheduler_type="cosine",
            logging_steps=10,
            eval_strategy="epoch",
            save_strategy="no",
            seed=args.semilla,
            report_to="none",
        ),
    )
    trainer.train()

    # --- exportar para Ollama ------------------------------------------
    args.salida.mkdir(parents=True, exist_ok=True)
    model.save_pretrained_gguf(str(args.salida), tokenizer, quantization_method="q4_k_m")

    modelfile = args.salida / "Modelfile"
    gguf = next(args.salida.glob("*.gguf"), None)
    modelfile.write_text(
        f"FROM ./{gguf.name if gguf else 'modelo.gguf'}\n"
        f"PARAMETER temperature {config.TEMPERATURA}\n"
        f"PARAMETER num_ctx {config.NUM_CTX}\n",
        encoding="utf-8",
    )
    print(f"\nListo. Para usarlo en tu máquina:\n"
          f"  ollama create supervisor -f {modelfile}\n"
          f"y en config.py:  MODELO = \"supervisor\"\n\n"
          f"Antes de darlo por bueno, compáralo con el base:\n"
          f"  python3 -m bot_sigue.evaluar {args.jsonl}   # con cada MODELO")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
