# Les Jeux Zozz’lympiques (édition Taghazout)

Les J.O. des slimes, de 2 à 16 joueurs, chacun sur son téléphone.

## Contenu V1
- Lobby : créer / rejoindre (code à 4 lettres ou lien partagé), choix du pays (16 pays, 1 par joueur)
- Modes : Jeu libre, Pentathlon, Heptathlon, Décathlon, Mode J.O. (V1 : 5 épreuves dispo, les modes piochent dans celles-ci)
- Barème 10-8-6-5-4-3-2-1 puis 0, égalité = mêmes points ; duels : 10 vainqueur / 8 perdant
- Épreuves : 100 m, Tir de vitesse, Saut en hauteur, Hip-Hop, Curling (duel, bot si joueur impair)
- Fond 3D (Three.js) : slimes aux couleurs des pays, décor selon l'épreuve, podium final

## Lancer en local
```
npm install
npm start
```
Puis http://localhost:3000 (sur le même Wi-Fi : http://IP-de-ton-PC:3000 depuis les téléphones).

## Mettre en ligne sur Render (gratuit)
1. Pousse ce dossier dans un dépôt GitHub.
2. Sur render.com : New → Web Service → choisis le dépôt.
3. Build command : `npm install` — Start command : `npm start`.
4. Partage l'URL fournie (ex. https://bubblegame.onrender.com).

Le plan gratuit met le serveur en veille après 15 min sans visite : ouvre l'URL une minute avant de jouer.
Netlify ne convient pas seul (pas de serveur temps réel) ; Render héberge tout (serveur + pages).

## Entraînement contre des bots (hors ligne)
Sur l'écran d'accueil : « Entraînement contre des bots ». Tout tourne dans le téléphone, sans serveur.
Après une première visite du site (en ligne), le jeu est mis en cache : il s'ouvre ensuite même sans réseau
et bascule tout seul en mode bots. Astuce : « Ajouter à l'écran d'accueil » pour l'avoir comme une appli.

## Épreuves à capteurs
Haltérophilie, tir à l'arc et ski utilisent l'inclinaison du téléphone (autorisation demandée sur iPhone
au bouton « Prêt »). Sans capteur, on joue en glissant le doigt.
