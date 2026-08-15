"""Pruebas de las herramientas de evidencia.

Se ejecutan con la biblioteca estándar, sin instalar nada:

    cd herramientas && python -m unittest discover -s tests -v

Ninguna prueba puede depender de la red, del reloj real ni de la evidencia de
campo: todas construyen sus propios árboles y servidores falsos.
"""
