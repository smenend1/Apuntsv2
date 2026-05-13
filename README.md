# Apunts Lens

PWA en català per convertir una foto d'apunts en una imatge final amb estil d'apunts manuscrits.

## Què fa

1. Permet fer una foto o pujar una imatge des del mòbil.
2. Fa OCR local al navegador amb Tesseract.js.
3. Permet revisar i corregir el text detectat.
4. Genera una estructura d'apunts: tema, resum, conceptes, explicació ordenada, exemples i preguntes.
5. Renderitza el resultat com una imatge PNG amb estil de full d'apunts manuscrits.
6. Es pot instal·lar com a PWA al mòbil.

## Limitació important

Aquest MVP fa OCR local amb Tesseract.js. Per text imprès pot funcionar prou bé, però per lletra manuscrita en pissarra o full pot fallar bastant. Per una versió realment bona amb manuscrits, recomanació sincera:

- mantenir aquesta PWA com a interfície,
- enviar la imatge a un backend,
- fer OCR amb Google Cloud Vision, Azure AI Vision o un servei especialitzat,
- tornar el text a la PWA,
- deixar que l'usuari revisi el text,
- i després generar la imatge d'apunts amb Canvas.

## Com pujar-ho a GitHub Pages

1. Crea un repositori nou a GitHub.
2. Puja tots els fitxers d'aquest ZIP a l'arrel del repositori.
3. Ves a `Settings > Pages`.
4. A `Build and deployment`, tria `Deploy from a branch`.
5. Selecciona la branca `main` i la carpeta `/root`.
6. Guarda els canvis.
7. Obre l'URL que et dona GitHub Pages.

## Instal·lació al mòbil

### Android / Chrome

1. Obre la web publicada.
2. Toca el menú de Chrome.
3. Toca `Afegeix a la pantalla d'inici` o `Instal·la app`.

### iPhone / Safari

1. Obre la web publicada amb Safari.
2. Toca el botó de compartir.
3. Toca `Afegir a la pantalla d'inici`.

## Estructura

```text
index.html
styles.css
app.js
manifest.webmanifest
sw.js
icons/
  icon-192.png
  icon-512.png
README.md
```

## Millores recomanades

- Retall automàtic de la pissarra o full.
- Correcció de perspectiva.
- Millora de contrast abans de l'OCR.
- Backend per OCR manuscrit avançat.
- IA per transformar millor el text brut en apunts.
- Exportació a PDF.
- Guardar apunts a IndexedDB.
