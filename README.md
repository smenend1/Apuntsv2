# Apunts Lens


## Canvi v3: càmera i galeria separades

En mòbil, alguns navegadors obren sempre la càmera si l'input de fitxer té `capture="environment"`.
Aquesta versió té dos controls diferents:

- **Fer foto amb la càmera**: manté `capture="environment"`.
- **Escollir de la galeria**: no porta `capture`, així hauria d'obrir el selector de fotos/arxius.

Si Android o iOS encara obre la càmera, prova el botó de galeria des del navegador normal i no des d'una app incrustada.
