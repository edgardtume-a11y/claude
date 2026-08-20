# -*- coding: utf-8 -*-
"""Estilo visual unico para los PDF que se le entregan a Jean.

Paleta clasica: fondo crema, acentos color arcilla/terracota, titulos en serif.
NUNCA usar el azul generico ni fondos oscuros. Ver CLAUDE.md en la raiz.

Uso:
    from estilo_claude_pdf import *
    doc, S = documento('salida.pdf', 'Titulo', 'Subtitulo', 'ETIQUETA')
    S.extend(h1('1. Seccion'))
    S.append(Paragraph('texto', st_body))
    doc.build(S)
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether, ListFlowable,
                                ListItem, HRFlowable, NextPageTemplate, CondPageBreak)

# ------------------------------------------------------------------ paleta
MARFIL   = colors.HexColor('#FAF9F5')   # fondo de pagina
CREMA    = colors.HexColor('#F0EEE6')   # cajas
MANILA   = colors.HexColor('#E5DFD3')   # bandas y cabeceras de tabla
ARENA    = colors.HexColor('#EDE9DD')   # cajas de refuerzo
FILA     = colors.HexColor('#F4F1E9')   # filas alternas
BORDE    = colors.HexColor('#D8D0C0')
ARCILLA  = colors.HexColor('#CC785C')   # acento principal
ARC_OSC  = colors.HexColor('#8C4A32')   # titulos y texto sobre claro
DURAZNO  = colors.HexColor('#F8E7DB')   # caja de aviso
DUR_BOR  = colors.HexColor('#DFAF90')
TINTA    = colors.HexColor('#2C2A26')
GRIS     = colors.HexColor('#6E6A60')

# ------------------------------------------------------------- tipografia
SERIF, SERIF_B = 'Helvetica', 'Helvetica-Bold'
try:
    pdfmetrics.registerFont(TTFont('DejaSerif',   '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'))
    pdfmetrics.registerFont(TTFont('DejaSerif-B', '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'))
    SERIF, SERIF_B = 'DejaSerif', 'DejaSerif-B'
except Exception:
    pass

ANCHO = A4[0] - 4.6*cm

def P(name, **kw):
    base = dict(fontName='Helvetica', fontSize=10.2, leading=14.6, textColor=TINTA,
                spaceAfter=6, alignment=TA_JUSTIFY)
    base.update(kw)
    return ParagraphStyle(name, **base)

st_h1      = P('h1', fontName=SERIF_B, fontSize=12.5, leading=16, textColor=ARC_OSC,
               alignment=0, spaceBefore=13, spaceAfter=4)
st_h2      = P('h2', fontName='Helvetica-Bold', fontSize=10.8, leading=14,
               textColor=ARC_OSC, alignment=0, spaceBefore=8, spaceAfter=3)
st_body    = P('body')
st_bul     = P('bul', spaceAfter=3, leading=14.2)
st_cita    = P('cita', fontName='Helvetica-Oblique', fontSize=10.3, leading=14,
               textColor=GRIS, alignment=TA_CENTER, spaceAfter=1)
st_caja    = P('caja', fontSize=10.1, leading=14.3)
st_caja_izq= P('cajai', fontSize=10.1, leading=14.3, alignment=0)
st_cajatit = P('cajatit', fontName='Helvetica-Bold', fontSize=9.6, leading=13,
               textColor=ARC_OSC, spaceAfter=3, alignment=0)
st_th      = P('th', fontName='Helvetica-Bold', fontSize=9.2, leading=11.8,
               textColor=TINTA, alignment=0, spaceAfter=0)
st_td      = P('td', fontSize=9.0, leading=12.0, alignment=0, spaceAfter=0)
st_tdb     = P('tdb', fontName='Helvetica-Bold', fontSize=9.0, leading=12.0,
               textColor=ARC_OSC, alignment=0, spaceAfter=0)
st_nota    = P('nota', fontName='Helvetica-Oblique', fontSize=8.6, leading=11.6,
               textColor=GRIS)

# -------------------------------------------------------------- elementos
def bullets(items, style=st_bul):
    """Lista con vinetas color arcilla."""
    return ListFlowable(
        [ListItem(Paragraph(t, style), leftIndent=15) for t in items],
        bulletType='bullet', start='•', bulletFontSize=9,
        bulletColor=ARCILLA, leftIndent=15, spaceBefore=1, spaceAfter=5)

def caja(titulo, texto, fondo=CREMA, borde=BORDE, ancho=ANCHO, justificar=True):
    """Caja destacada con filete arcilla a la izquierda.

    fondo=DURAZNO/borde=DUR_BOR para avisos; fondo=ARENA para refuerzos.
    """
    inner = []
    if titulo:
        inner.append(Paragraph(titulo, st_cajatit))
    inner.append(Paragraph(texto, st_caja if justificar else st_caja_izq))
    t = Table([[inner]], colWidths=[ancho])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), fondo),
        ('BOX', (0,0), (-1,-1), 0.7, borde),
        ('LINEBEFORE', (0,0), (0,-1), 3.0, ARCILLA),
        ('LEFTPADDING', (0,0), (-1,-1), 11), ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8), ('BOTTOMPADDING', (0,0), (-1,-1), 9),
    ]))
    return t

def h1(txt):
    """Titulo de seccion. Devuelve una LISTA: usar S.extend(h1('...'))."""
    hr = HRFlowable(width='100%', thickness=1.4, color=ARCILLA, spaceBefore=0, spaceAfter=6)
    return [CondPageBreak(2.8*cm), KeepTogether([Paragraph(txt, st_h1), hr])]

def tabla(datos, anchos):
    """Tabla con cabecera manila; la primera columna va resaltada en arcilla."""
    filas = [[Paragraph(c, st_th) for c in datos[0]]]
    for r in datos[1:]:
        filas.append([Paragraph(r[0], st_tdb)] + [Paragraph(c, st_td) for c in r[1:]])
    t = Table(filas, colWidths=anchos, repeatRows=1)
    estilo = [
        ('BACKGROUND', (0,0), (-1,0), MANILA),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDE),
        ('LINEBELOW', (0,0), (-1,0), 1.4, ARCILLA),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ('TOPPADDING', (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]
    for i in range(1, len(filas)):
        if i % 2 == 0:
            estilo.append(('BACKGROUND', (0,i), (-1,i), FILA))
    t.setStyle(TableStyle(estilo))
    return t

def documento(ruta, titulo, subtitulo='', etiqueta='', pie=''):
    """Crea el BaseDocTemplate y la lista de flowables ya con la portada puesta.

    Devuelve (doc, S). La primera pagina lleva la banda manila con el titulo;
    las siguientes, un filete arcilla y el texto de `pie` como encabezado corrido.
    """
    lineas = titulo.split('\n')
    corrido = pie or titulo.replace('\n', ' ')

    def cabecera(canvas, doc_):
        canvas.saveState()
        canvas.setFillColor(MARFIL)
        canvas.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
        if doc_.page == 1:
            canvas.setFillColor(MANILA)
            canvas.rect(0, A4[1]-4.35*cm, A4[0], 4.35*cm, stroke=0, fill=1)
            canvas.setFillColor(ARCILLA)
            canvas.rect(0, A4[1]-4.5*cm, A4[0], 0.15*cm, stroke=0, fill=1)
            if etiqueta:
                canvas.setFillColor(ARC_OSC)
                canvas.setFont('Helvetica-Bold', 8.5)
                canvas.drawString(2.3*cm, A4[1]-1.45*cm, etiqueta)
            canvas.setFillColor(TINTA)
            canvas.setFont(SERIF_B, 19)
            for i, ln in enumerate(lineas[:2]):
                canvas.drawString(2.3*cm, A4[1]-(2.6+0.8*i)*cm, ln)
            if subtitulo:
                canvas.setFillColor(GRIS)
                canvas.setFont('Helvetica', 9.5)
                canvas.drawString(2.3*cm, A4[1]-4.02*cm, subtitulo)
        else:
            canvas.setFillColor(ARCILLA)
            canvas.rect(0, A4[1]-1.35*cm, A4[0], 0.11*cm, stroke=0, fill=1)
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(GRIS)
            canvas.drawString(2.3*cm, A4[1]-1.1*cm, corrido)
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(GRIS)
        canvas.drawCentredString(A4[0]/2, 1.15*cm, 'Página %d' % doc_.page)
        canvas.restoreState()

    doc = BaseDocTemplate(ruta, pagesize=A4,
                          leftMargin=2.3*cm, rightMargin=2.3*cm,
                          topMargin=2.0*cm, bottomMargin=1.9*cm,
                          title=titulo.replace('\n', ' '), author='Resumen de estudio')
    doc.addPageTemplates([
        PageTemplate(id='primera', onPage=cabecera,
                     frames=[Frame(2.3*cm, 1.9*cm, ANCHO, A4[1]-1.9*cm-5.0*cm, id='p1')]),
        PageTemplate(id='resto', onPage=cabecera,
                     frames=[Frame(2.3*cm, 1.9*cm, ANCHO, A4[1]-1.9*cm-2.0*cm, id='pn')]),
    ])
    return doc, [NextPageTemplate('resto')]
