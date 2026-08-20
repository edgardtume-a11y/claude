VOZ DEL COUNTDOWN — CLIPS LOCALES OPCIONALES (V3.4)
====================================================

Prioridad de la voz (js/countdown-voice.js):
  1. CLIPS LOCALES de esta carpeta (si manifest.json existe y los declara)
  2. SpeechSynthesis del navegador (ES → es-CO preferente; EN → en-US)
  3. beep + texto (nunca se bloquea el lanzamiento)

Para activar clips propios (p. ej. una voz grabada con licencia apropiada):

1. Coloca los archivos .ogg o .mp3 en subcarpetas es/ y en/:
     assets/audio/voice/es/5.ogg 4.ogg 3.ogg 2.ogg 1.ogg ignition.ogg liftoff.ogg
     assets/audio/voice/en/5.ogg ... liftoff.ogg
2. Crea manifest.json en ESTA carpeta con las rutas relativas:
     {
       "es": { "5":"es/5.ogg", "4":"es/4.ogg", "3":"es/3.ogg",
                "2":"es/2.ogg", "1":"es/1.ogg",
                "ignition":"es/ignition.ogg", "liftoff":"es/liftoff.ogg" },
       "en": { "5":"en/5.ogg", "4":"en/4.ogg", "3":"en/3.ogg",
                "2":"en/2.ogg", "1":"en/1.ogg",
                "ignition":"en/ignition.ogg", "liftoff":"en/liftoff.ogg" }
     }
3. Recarga. Sin manifest.json el sistema usa SpeechSynthesis (sin 404s).

No usar servicios TTS externos en runtime; ningún dato del visitante debe
salir del navegador (brief V3.4 §14).
