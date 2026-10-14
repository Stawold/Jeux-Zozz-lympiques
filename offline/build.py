# Assemble la version hors-ligne (une seule page) à partir des fichiers de public/
import re, pathlib
d = pathlib.Path(__file__).resolve().parent.parent
pub = d / 'public'

def strip(src):
    src = re.sub(r"^import .* from '\./[a-z0-9]+\.js';\n", '', src, flags=re.M)
    src = re.sub(r'^export \{[^}]*\};\n?', '', src, flags=re.M)
    src = re.sub(r'^export (const|function|async function) ', r'\1 ', src, flags=re.M)
    return src

parts = [strip((pub / f).read_text()) for f in ['kit.js', 'games.js', 'races.js', 'solos.js', 'duels.js', 'extra.js']]
main = (pub / 'main.js').read_text()
main = re.sub(r"const GAMES = \{[^}]*\};", "const GAMES = { tir, hauteur, hiphop, curling, sprint, haies, cyclisme, natation, aviron, longueur, skate, basket, rugby, golf, football, handball, escrime, haltero, arc, ski, marteau, escalade, judo };", main)
main = strip(main)
css = (pub / 'style.css').read_text()
loc = (pub / 'bots.js').read_text() + '\nwindow.OFFLINE = true; window.OFFLINE_ONLY = true; window.io = () => window.makeBotSocket();\n'
html = f'''<title>Jeux Zozz’lympiques</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@600;800;900&family=Barlow:wght@500;600;700&display=swap" rel="stylesheet">
<style>{css}</style>
<canvas id="bg"></canvas>
<div id="app"></div>
<div id="toast"></div>
<script>{loc}</script>
<script type="importmap">{{ "imports": {{ "three": "https://unpkg.com/three@0.160.0/build/three.module.js" }} }}</script>
<script type="module">
{chr(10).join(parts)}
{main}
</script>
'''
(d / 'offline' / 'zozzlympiques-entrainement.html').write_text(html)
print('ok', len(html))
