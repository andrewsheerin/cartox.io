import json
import os

BASE_DIR = os.path.dirname(__file__)
GEOJSON_PATH = os.path.join(BASE_DIR, 'static', 'countries.geo.json')

def main():
    if not os.path.exists(GEOJSON_PATH):
        print(f'GeoJSON not found at: {GEOJSON_PATH}')
        return

    with open(GEOJSON_PATH, 'r', encoding='utf-8') as fh:
        data = json.load(fh)

    names = []
    for feat in data.get('features', []):
        props = feat.get('properties') or {}
        name = props.get('name_en')
        if name:
            names.append(name)

    # deduplicate while preserving order
    seen = set()
    unique = []
    for n in names:
        if n not in seen:
            seen.add(n)
            unique.append(n)

    # write a plain text file and a python file with the list
    out_txt = os.path.join(BASE_DIR, 'names_en.txt')
    out_py = os.path.join(BASE_DIR, 'names_en.py')

    with open(out_txt, 'w', encoding='utf-8') as fh:
        for n in unique:
            fh.write(n + '\n')

    with open(out_py, 'w', encoding='utf-8') as fh:
        fh.write('NAMES = ' + repr(unique) + '\n')

    print(f'Extracted {len(unique)} unique name_en values')
    print(f'Wrote: {out_txt}')
    print(f'Wrote: {out_py}')

if __name__ == '__main__':
    main()

