const GAMES = [
  {
    id: "echecs",
    name: "Échecs",
    category: "Stratégie classique",
    players: "2 joueurs",
    duration: "10 à 90 min",
    difficulty: "Intermédiaire à expert",
    intro: "Un duel stratégique où chaque pièce possède son propre mouvement et où le roi adverse doit être mis échec et mat.",
    goal: "Mettre le roi adverse échec et mat : il est attaqué et aucune défense légale n'est possible.",
    rules: [
      "Installez l'échiquier avec une case claire en bas à droite. Les dames commencent sur leur couleur.",
      "Les Blancs jouent en premier, puis les joueurs alternent un coup chacun.",
      "Chaque type de pièce a son mouvement : roi, dame, tour, fou, cavalier et pion.",
      "Une pièce adverse est capturée lorsqu'une pièce arrive sur sa case, sauf cas particuliers du pion.",
      "Un joueur ne peut jamais laisser son propre roi en échec.",
      "La partie se termine par échec et mat, abandon ou partie nulle selon plusieurs situations."
    ],
    tips: "Commencez par développer les cavaliers et les fous, contrôlez le centre et mettez votre roi à l'abri par le roque.",
    demo: true,
    art: "chess"
  },
  {
    id: "dames",
    name: "Dames",
    category: "Stratégie classique",
    players: "2 joueurs",
    duration: "15 à 45 min",
    difficulty: "Accessible",
    intro: "Deux grandes variantes à découvrir : les dames françaises/internationales sur 10 × 10 et les dames anglaises sur 8 × 8, avec des règles de prise et de déplacement différentes.",
    goal: "Capturer toutes les pièces adverses ou les empêcher de jouer, en respectant les règles propres à la variante choisie.",
    rules: [
      "Placez les pions sur les cases foncées des premières rangées selon la variante utilisée.",
      "Un pion se déplace en diagonale vers l'avant sur une case libre.",
      "Pour capturer, sautez par-dessus une pièce adverse vers une case libre située juste derrière.",
      "Lorsqu'une autre capture est possible après un saut, la rafle se poursuit selon les règles de la variante.",
      "Un pion qui atteint la dernière rangée devient une dame et gagne une mobilité supérieure.",
      "La partie est gagnée lorsque l'adversaire n'a plus de pièce ou plus de coup légal."
    ],
    tips: "Évitez de laisser des pièces isolées et essayez de conserver une ligne défensive arrière en début de partie.",
    demo: true,
    art: "checkers"
  },
  {
    id: "go",
    name: "Go",
    category: "Stratégie classique",
    players: "2 joueurs",
    duration: "20 à 120 min",
    difficulty: "Simple à apprendre, très profond",
    intro: "Deux joueurs posent alternativement des pierres noires et blanches pour contrôler le plus de territoire possible.",
    goal: "Terminer avec davantage de territoire et de points que l'adversaire.",
    rules: [
      "Les pierres se posent sur les intersections du goban et ne se déplacent plus ensuite.",
      "Noir joue le premier, puis les joueurs posent une pierre à tour de rôle.",
      "Une pierre ou un groupe sans liberté est capturé et retiré du plateau.",
      "La règle du ko empêche de répéter immédiatement une position identique.",
      "Un joueur peut passer. Deux passes consécutives mettent généralement fin à la partie.",
      "Le score dépend du système utilisé : territoire, pierres vivantes et éventuel komi pour Blanc."
    ],
    tips: "Au début, privilégiez les coins puis les bords : il faut moins de pierres pour y construire un territoire viable.",
    demo: true,
    art: "go"
  },
  {
    id: "awale",
    name: "Awélé",
    category: "Mancala / stratégie",
    players: "2 joueurs",
    duration: "10 à 30 min",
    difficulty: "Accessible",
    intro: "Un jeu africain de semailles et de captures où l'on distribue des graines de case en case.",
    goal: "Capturer plus de graines que l'adversaire. Avec 25 graines ou plus, la victoire est acquise.",
    rules: [
      "Le plateau comporte 12 cases, 6 par joueur, contenant 4 graines chacune au départ.",
      "À son tour, un joueur choisit une de ses cases et sème toutes les graines une à une dans le sens antihoraire.",
      "Si un tour complet est effectué, la case de départ est sautée lors du passage suivant.",
      "Si la dernière graine tombe chez l'adversaire et porte une case à 2 ou 3 graines, ces graines sont capturées.",
      "La capture peut remonter sur plusieurs cases adverses consécutives contenant 2 ou 3 graines.",
      "Un joueur doit nourrir l'adversaire si celui-ci n'a plus de graines, lorsqu'un coup nourrissant est possible."
    ],
    tips: "Comptez les graines avant de jouer : une seule semaille peut préparer plusieurs captures successives.",
    demo: true,
    art: "awale"
  },
  {
    id: "abalone",
    name: "Abalone",
    category: "Stratégie abstraite",
    players: "2 joueurs",
    duration: "20 à 45 min",
    difficulty: "Intermédiaire",
    intro: "Deux groupes de billes s'affrontent sur un plateau hexagonal. Le but est de pousser les billes adverses hors du plateau.",
    goal: "Éjecter six billes adverses du plateau.",
    rules: [
      "Chaque joueur dispose d'un ensemble de billes placé selon la position de départ choisie.",
      "À son tour, un joueur déplace une, deux ou trois billes adjacentes d'une case.",
      "Un déplacement en ligne peut pousser un groupe adverse moins nombreux : 2 contre 1 ou 3 contre 1 ou 2.",
      "On ne peut jamais pousser une ligne adverse de force égale ou supérieure.",
      "Les déplacements latéraux sont autorisés lorsqu'aucune case d'arrivée n'est occupée.",
      "Dès qu'un joueur a éjecté six billes adverses, il gagne la partie."
    ],
    tips: "Gardez vos billes groupées et évitez les bords : les billes isolées sont beaucoup plus faciles à éjecter.",
    demo: true,
    art: "abalone"
  },
  {
    id: "catan",
    name: "Les Colons de Catan",
    category: "Jeu de plateau moderne",
    players: "3 à 4 joueurs",
    duration: "60 à 120 min",
    difficulty: "Accessible / intermédiaire",
    intro: "Développez des colonies et des routes sur une île modulaire en échangeant des ressources avec les autres joueurs.",
    goal: "Atteindre le nombre de points de victoire requis par la partie, généralement 10 dans le jeu de base.",
    rules: [
      "Construisez le plateau avec les tuiles de terrain, les numéros et les ports selon le scénario choisi.",
      "Chaque joueur place des colonies et routes initiales en respectant la règle de distance.",
      "Au début du tour, deux dés déterminent quels terrains produisent des ressources.",
      "Le joueur actif peut commercer avec les autres joueurs et avec la banque selon les taux disponibles.",
      "Les ressources servent à construire routes, colonies, villes et cartes de développement.",
      "Le voleur s'active sur un 7 et bloque la production d'une tuile jusqu'à son déplacement."
    ],
    tips: "Diversifiez les nombres et les ressources dès le départ, et surveillez les possibilités de route la plus longue.",
    demo: false,
    art: "catan"
  },
  {
    id: "carcassonne",
    name: "Carcassonne",
    category: "Jeu de tuiles",
    players: "2 à 5 joueurs",
    duration: "30 à 60 min",
    difficulty: "Accessible",
    intro: "Construisez progressivement un paysage médiéval avec des tuiles et placez vos partisans pour marquer des points.",
    goal: "Obtenir le plus grand nombre de points grâce aux villes, routes, monastères et champs.",
    rules: [
      "À son tour, le joueur pioche une tuile paysage et doit la placer en raccordant correctement les côtés.",
      "Après la pose, il peut placer un partisan sur un élément libre de la tuile nouvellement posée.",
      "Une route, une ville ou un monastère terminé est immédiatement décompté selon les règles correspondantes.",
      "Les partisans récupérés après un décompte peuvent être réutilisés lors de tours ultérieurs.",
      "Les champs restent généralement occupés jusqu'à la fin de la partie.",
      "Lorsque toutes les tuiles ont été posées, les éléments inachevés et les champs sont décomptés."
    ],
    tips: "Ne bloquez pas trop de partisans dans de très grands projets : un stock disponible offre davantage d'options tactiques.",
    demo: false,
    art: "carcassonne"
  },
  {
    id: "cartes",
    name: "Jeux de cartes",
    category: "Hasard & tactique",
    players: "1 à plusieurs",
    duration: "Variable",
    difficulty: "Variable",
    intro: "Un univers très vaste : belote, tarot, rami, poker, patience, canasta et de nombreuses variantes régionales.",
    goal: "L'objectif dépend du jeu : faire des plis, constituer des combinaisons, se défausser ou optimiser une main.",
    rules: [
      "Choisissez un jeu et définissez le nombre de cartes, les valeurs et les couleurs utilisées.",
      "Distribuez les cartes selon la règle du jeu choisi.",
      "Les joueurs jouent ensuite selon une mécanique principale : plis, défausse, combinaison ou mise.",
      "Les jokers, atouts et cartes spéciales éventuelles suivent les règles propres à chaque variante.",
      "Le calcul des points peut se faire après chaque manche ou à la fin d'une partie complète.",
      "Avant de jouer, précisez toujours la variante locale pour éviter les ambiguïtés."
    ],
    tips: "Pour les jeux de plis, mémoriser les cartes déjà sorties est souvent plus important que d'avoir de bonnes cartes en main.",
    demo: false,
    art: "cards"
  },
  {
    id: "yams",
    name: "Yams",
    category: "Hasard & probabilités",
    players: "1 à 2 joueurs",
    duration: "20 à 45 min",
    difficulty: "Accessible",
    intro: "Lancez cinq dés, conservez ceux qui vous intéressent et remplissez intelligemment votre feuille de score en treize tours.",
    goal: "Obtenir le meilleur total après avoir rempli les treize catégories de la feuille de score.",
    rules: [
      "Chaque joueur dispose de cinq dés et peut effectuer jusqu’à trois lancers pendant son tour.",
      "Après le premier et le deuxième lancer, il peut conserver certains dés et relancer les autres.",
      "À la fin du tour, il doit inscrire le résultat dans une catégorie encore libre, même si celle-ci rapporte zéro point.",
      "La partie supérieure additionne les As, Deux, Trois, Quatre, Cinq et Six. Un bonus de 35 points est accordé à partir de 63 points.",
      "La partie inférieure comprend Brelan, Carré, Full, Petite suite, Grande suite, Yams et Chance.",
      "Lorsque les treize catégories ont été remplies par tous les joueurs, le total le plus élevé gagne."
    ],
    tips: "Ne cherchez pas toujours le Yams : protéger le bonus supérieur et savoir sacrifier une mauvaise case est souvent plus rentable.",
    demo: true,
    art: "dice"
  },
  {
    id: "des",
    name: "Jeux de dés",
    category: "Hasard & probabilités",
    players: "1 à plusieurs",
    duration: "5 à 60 min",
    difficulty: "Très accessible",
    intro: "Des jeux rapides où le hasard domine, souvent enrichis par des choix de relance, de prise de risque et de score.",
    goal: "Selon le jeu, réaliser des combinaisons, atteindre un score ou gérer au mieux le risque.",
    rules: [
      "Définissez le nombre et le type de dés nécessaires.",
      "Chaque joueur lance les dés selon la séquence prévue.",
      "Selon le jeu, certains dés peuvent être gardés et les autres relancés.",
      "Les combinaisons ou résultats sont convertis en points selon une table de score.",
      "Des règles de prise de risque peuvent permettre de continuer à lancer au prix d'une perte potentielle.",
      "La partie s'arrête après un nombre de manches, un objectif de score ou une condition précise."
    ],
    tips: "Les probabilités deviennent très utiles dès qu'un jeu permet de choisir quels dés relancer.",
    demo: false,
    art: "dice"
  },
  {
    id: "dominos",
    name: "Dominos",
    category: "Hasard & placement",
    players: "2 à 4 joueurs",
    duration: "15 à 40 min",
    difficulty: "Accessible",
    intro: "Alignez les dominos en faisant correspondre leurs valeurs et essayez de vider votre main avant vos adversaires.",
    goal: "Être le premier à poser tous ses dominos ou terminer avec le moins de points en main selon la variante.",
    rules: [
      "Mélangez les dominos face cachée et distribuez-en un nombre déterminé à chaque joueur.",
      "Le premier domino est posé selon la règle de départ de la variante.",
      "À son tour, un joueur ajoute un domino dont une extrémité correspond à l'une des extrémités libres de la chaîne.",
      "S'il ne peut pas jouer, il pioche ou passe selon la variante.",
      "Les doubles peuvent être placés transversalement pour une meilleure lisibilité.",
      "La manche prend fin lorsqu'un joueur n'a plus de domino ou lorsque le jeu est bloqué."
    ],
    tips: "Essayez de conserver plusieurs valeurs différentes en main pour éviter d'être rapidement bloqué.",
    demo: false,
    art: "domino"
  }
];
