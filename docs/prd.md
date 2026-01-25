# Looptrading - Product Requirements Document (PRD)

## 1. Goals and Background Context

### 1.1 Goals

- Centraliser 100% du workflow de swing trading dans une interface unique et personnalisée
- Recevoir des alertes d'achat proactives basées sur des critères techniques combinés (pullback, breakout, croisement MACD)
- Réduire le temps de recherche quotidien de 50% en automatisant le screening et l'agrégation de données
- Visualiser clairement les opportunités d'achat avec les données techniques et fondamentales associées
- Consulter son portefeuille IBKR en lecture seule pour avoir une vue d'ensemble

### 1.2 Background Context

Les traders individuels font face à une fragmentation importante de leurs outils : graphiques sur TradingView, news sur Bloomberg/Reuters, screeners sur Finviz, exécution sur le broker. Cette dispersion entraîne des opportunités manquées, des décisions sous-optimales et une perte de temps significative.

Looptrading résout ce problème en centralisant screening intelligent, analyse visuelle et veille automatisée dans une application web personnelle. L'application fournit des alertes claires et actionnables ainsi qu'une vue lecture seule du portefeuille IBKR - **l'exécution des ordres se fait exclusivement sur la plateforme IBKR** (contrainte permanente de sécurité). L'approche swing trading tolère un délai de 15 minutes sur les données, permettant l'utilisation d'APIs gratuites.

### 1.3 Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-23 | 1.0 | Création initiale du PRD | Sarah (PO) |
| 2026-01-25 | 1.1 | Simplification : suppression Docker/Redis, migration vers node-cron | Winston (Architect) |
| 2026-01-25 | 1.2 | Suppression IBKR : portfolio manuel, news Yahoo Finance | Winston (Architect) |

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement |
|----|-------------|
| **FR1** | Le système doit permettre de filtrer les actions US et EU selon des critères techniques configurables (RSI, MACD, SMA, EMA, Bollinger Bands, volume) |
| **FR2** | Le système doit afficher des graphiques en chandeliers japonais interactifs avec superposition d'indicateurs techniques |
| **FR3** | Le système doit calculer un score composite (0-100) pour chaque action basé sur : tendance LT (25%), tendance MT (20%), momentum (20%), volume (15%), sentiment (10%), proximité support (10%) |
| **FR4** | Le système doit envoyer des alertes (email et/ou notification push) lorsqu'une action atteint un score > 75 ou correspond aux stratégies configurées |
| **FR5** | Le système doit supporter trois stratégies d'alerte : Pullback sur tendance haussière, Breakout avec volume, Croisement MACD |
| **FR6** | Le système doit afficher les news financières (Yahoo Finance) et les associer aux actions surveillées |
| **FR7** | Le système doit afficher un dashboard principal avec : alertes actives, watchlist, score des opportunités, résumé portefeuille |
| **FR8** | Le système doit permettre de gérer manuellement un portfolio (positions, PRU) et calculer le P&L en temps réel via Yahoo Finance |
| **FR9** | Le système doit permettre de créer et gérer une watchlist personnalisée avec alertes spécifiques par action |
| **FR10** | Le système doit calculer et afficher les indicateurs techniques suivants : SMA (20, 50, 200), EMA (9, 21), RSI (14), MACD (12, 26, 9), Bollinger Bands (20, 2), Volume moyen (20j), OBV |

### 2.2 Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| **NFR1** | **Simplicité** : Le système doit fonctionner sans dépendance externe (pas de Docker, pas de service tiers requis au runtime) |
| **NFR2** | Le temps de chargement initial du dashboard doit être < 3 secondes |
| **NFR3** | La latence des données de marché doit être ≤ 15 minutes (contrainte APIs gratuites) |
| **NFR4** | Le système doit fonctionner sur les navigateurs Chrome, Firefox et Safari (dernières versions) |
| **NFR5** | L'interface doit être responsive : desktop-first avec adaptation tablette et mobile |
| **NFR6** | Le système doit pouvoir surveiller au minimum 500 actions simultanément |
| **NFR7** | Les données et configurations doivent être stockées localement (SQLite/PostgreSQL) |
| **NFR8** | Le système doit utiliser exclusivement des APIs gratuites ou freemium pour les données de marché |
| **NFR9** | Le taux de faux positifs des alertes doit être < 20% |
| **NFR10** | Le système doit être hébergé localement (pas de dépendance cloud obligatoire) |

---

## 3. User Interface Design Goals

### 3.1 Overall UX Vision

Une interface **sobre et professionnelle** orientée données, inspirée des terminaux de trading mais simplifiée pour un usage personnel. L'accent est mis sur la lisibilité des informations critiques (alertes, scores, graphiques) avec un minimum de clics pour accéder aux données importantes. Dark mode exclusif pour une esthétique geek/terminal.

### 3.2 Key Interaction Paradigms

- **Dashboard-centric** : Toutes les informations clés visibles en un coup d'œil
- **Drill-down progressif** : Clic sur une action → détails complets (graphique, indicateurs, news)
- **Filtrage dynamique** : Screener avec filtres en temps réel sans rechargement de page
- **Notifications non-intrusives** : Alertes visibles mais ne bloquant pas le workflow
- **Watchlist drag & drop** : Réorganisation intuitive des actions surveillées

### 3.3 Core Screens and Views

| Écran | Description |
|-------|-------------|
| **Dashboard principal** | Vue d'ensemble : alertes actives, top opportunités (score), résumé portefeuille, watchlist condensée |
| **Screener** | Tableau filtrable de toutes les actions avec colonnes configurables (prix, score, indicateurs) |
| **Détail action** | Graphique interactif plein écran + indicateurs + news IBKR + historique alertes |
| **Watchlist** | Liste personnalisée avec mini-graphiques et scores, alertes configurables par action |
| **Portefeuille** | Positions IBKR (lecture seule), P&L, répartition sectorielle |
| **Configuration alertes** | Paramétrage des seuils et stratégies d'alerte |

### 3.4 Accessibility

**Aucune contrainte WCAG** - Usage personnel exclusif. Priorité à l'esthétique et la densité d'information.

### 3.5 Branding

**Esthétique "Geek / Terminal"**

- **Palette** : Fond noir/gris très sombre (#0d1117, #161b22), accents néon (vert matrix #00ff41, cyan #00d4ff, magenta #ff00ff pour les alertes critiques)
- **Typographie** : Monospace partout (JetBrains Mono, Fira Code, ou Source Code Pro), style terminal/IDE
- **Visuels** : Bordures fines, effet glow subtil sur les éléments actifs, inspiration Bloomberg Terminal / htop / TradingView dark
- **Données** : Vert pour gains/haussier, rouge pour pertes/baissier, cyan pour neutre/info

### 3.6 Target Device and Platforms

**Web Responsive - Desktop-first - Dark mode uniquement**

- Optimisé pour écrans larges (≥1440px) - expérience complète
- Tablette : dashboard et watchlist
- Mobile : alertes uniquement (consultation rapide)

---

## 4. Technical Assumptions

### 4.1 Repository Structure

**Monorepo** avec Turborepo

```
looptrading/
├── apps/
│   ├── web/                 # Frontend React
│   └── api/                 # Backend Node.js
├── packages/
│   └── shared/              # Types et utilitaires partagés
├── package.json
└── turbo.json
```

### 4.2 Service Architecture

**Monolith modulaire** - Frontend SPA + Backend API unique

- **Frontend** : React 18 SPA (Single Page Application)
- **Backend** : API REST Node.js avec WebSocket pour temps réel
- **Base de données** : SQLite (développement) / PostgreSQL (optionnel production)
- **Job Scheduler** : node-cron pour tâches planifiées (fetch données, calcul alertes)

### 4.3 Tech Stack

#### Backend

| Composant | Technologie |
|-----------|-------------|
| Framework | Fastify |
| ORM | Prisma |
| Base de données | SQLite / PostgreSQL |
| Job scheduler | node-cron |
| WebSocket | Socket.io |
| Validation | Zod |

#### Frontend

| Composant | Technologie |
|-----------|-------------|
| Framework | React 18 |
| Build tool | Vite |
| Styling | TailwindCSS |
| Charts | TradingView Lightweight Charts |
| State | Zustand |
| Tables | TanStack Table |
| HTTP/Cache | TanStack Query |

#### APIs de données

| Service | Usage |
|---------|-------|
| Yahoo Finance (yfinance) | Prix, historique, fondamentaux |
| Interactive Brokers | Portfolio, news, données temps réel |

### 4.4 Testing Requirements

- **Unit tests** : Vitest (frontend + backend)
- **Integration tests** : Tests API avec Supertest
- **E2E** : Optionnel post-MVP (Playwright)
- **Couverture minimale** : 70% sur la logique métier (calcul indicateurs, scoring, alertes)

### 4.5 Additional Technical Assumptions

- Node.js 20+ LTS
- pnpm comme gestionnaire de packages (monorepo)
- Aucune dépendance externe requise (pas de Docker, pas d'IB Gateway)

---

## 5. Epic List

| Epic | Titre | Objectif |
|------|-------|----------|
| **Epic 1** | Foundation & Infrastructure | Établir le socle technique : monorepo, database, API skeleton, shell frontend avec navigation |
| **Epic 2** | Portfolio & News | Gestion manuelle du portfolio et news Yahoo Finance |
| **Epic 3** | Market Data & Technical Indicators | Récupérer les données de marché et calculer tous les indicateurs techniques |
| **Epic 4** | Scoring & Screening | Implémenter le score composite et le screener filtrable |
| **Epic 5** | Alerts & Notifications | Système d'alertes avec stratégies configurables et notifications email/push |
| **Epic 6** | Dashboard & Visualization | Interface complète : dashboard, graphiques interactifs, watchlist, détail action |

---

## 6. Epic Details

### Epic 1: Foundation & Infrastructure

**Objectif** : Établir le socle technique complet permettant le développement itératif. À la fin de cet epic, le monorepo est fonctionnel avec CI basique, la base de données initialisée, l'API expose un health-check, et le frontend affiche une page d'accueil avec navigation.

#### Story 1.1: Initialisation du monorepo

> As a developer,
> I want a properly configured monorepo with Turborepo,
> so that I can develop frontend and backend in a unified structure.

**Acceptance Criteria:**
1. Monorepo initialisé avec pnpm workspaces et Turborepo
2. Workspace `apps/web` créé avec Vite + React 18 + TypeScript
3. Workspace `apps/api` créé avec Fastify + TypeScript
4. Workspace `packages/shared` créé pour types partagés
5. Scripts `dev`, `build`, `lint` fonctionnels à la racine
6. `.gitignore` et `README.md` configurés

#### Story 1.2: Configuration base de données et ORM

> As a developer,
> I want Prisma configured with SQLite,
> so that I can persist data locally.

**Acceptance Criteria:**
1. Prisma installé et configuré dans `apps/api`
2. Schema initial avec modèles : `Stock`, `Alert`, `WatchlistItem`, `UserSettings`
3. Migration initiale créée et appliquée
4. Script de seed pour données de test
5. Client Prisma généré et exporté

#### Story 1.3: API skeleton avec health-check

> As a developer,
> I want a basic Fastify API with health-check endpoint,
> so that I can verify the backend is operational.

**Acceptance Criteria:**
1. Fastify configuré avec plugins essentiels (cors, helmet)
2. Route `GET /health` retourne `{ status: "ok", timestamp: ... }`
3. Validation Zod intégrée
4. Logging structuré configuré
5. Variables d'environnement gérées via dotenv

#### Story 1.4: Frontend shell avec navigation

> As a user,
> I want a basic frontend with navigation,
> so that I can access the different sections of the app.

**Acceptance Criteria:**
1. React app avec TailwindCSS configuré (dark mode par défaut)
2. Layout principal avec sidebar de navigation
3. Routes configurées : Dashboard, Screener, Watchlist, Portfolio, Settings
4. Pages placeholder pour chaque route
5. Typographie monospace (JetBrains Mono) et palette néon appliquées
6. Responsive : sidebar collapse sur mobile

#### Story 1.5: Configuration du scheduler (node-cron)

> As a developer,
> I want a simple job scheduler configured,
> so that I can run periodic background tasks without external dependencies.

**Acceptance Criteria:**
1. `node-cron` installé et configuré dans `apps/api`
2. Module `SchedulerService` créé avec gestion centralisée des jobs
3. Job de test fonctionnel (log toutes les minutes en dev)
4. Gestion du démarrage/arrêt propre des jobs
5. Logs structurés pour chaque exécution de job

---

### Epic 2: Portfolio & News

**Objectif** : Permettre la gestion manuelle du portfolio (saisie/import des positions) et afficher les news financières via Yahoo Finance.

#### Story 2.1: Gestion du portfolio manuel

> As a user,
> I want to manage my portfolio positions manually,
> so that I can track my holdings alongside market opportunities.

**Acceptance Criteria:**
1. Table `Position` : symbol, quantity, avgCost, dateAcquired, notes
2. Endpoint `GET /api/portfolio/positions` retourne les positions avec P&L calculé
3. Endpoint `POST /api/portfolio/positions` pour ajouter une position
4. Endpoint `PUT /api/portfolio/positions/:id` pour modifier une position
5. Endpoint `DELETE /api/portfolio/positions/:id` pour supprimer une position
6. P&L calculé dynamiquement avec prix Yahoo Finance

#### Story 2.2: Import CSV du portfolio

> As a user,
> I want to import my portfolio from a CSV file,
> so that I can quickly set up my positions without manual entry.

**Acceptance Criteria:**
1. Endpoint `POST /api/portfolio/import` accepte un fichier CSV
2. Format CSV supporté : symbol, quantity, avgCost, dateAcquired (optionnel)
3. Validation de chaque ligne avec rapport d'erreurs
4. Option "remplacer tout" ou "ajouter aux existantes"
5. Template CSV téléchargeable

#### Story 2.3: News financières Yahoo Finance

> As a user,
> I want to see financial news for stocks,
> so that I can stay informed about market events.

**Acceptance Criteria:**
1. Endpoint `GET /api/news` retourne les news récentes pour la watchlist
2. Endpoint `GET /api/news/:symbol` retourne les news pour une action
3. Données : headline, timestamp, source, link
4. Cache des news (refresh toutes les 15 minutes)
5. Limite de 10 news par action

---

### Epic 3: Market Data & Technical Indicators

**Objectif** : Récupérer les données de marché (prix, volumes, historique) et calculer l'ensemble des indicateurs techniques définis.

#### Story 3.1: Service de données de marché

> As a user,
> I want real-time market data for stocks,
> so that I can analyze current prices and volumes.

**Acceptance Criteria:**
1. Service `MarketDataService` créé avec Yahoo Finance
2. Endpoint `GET /api/stocks/:symbol/quote` retourne prix actuel
3. Endpoint `GET /api/stocks/:symbol/history` retourne historique OHLCV
4. Support marchés US et EU (suffixes .PA, .DE, etc.)
5. Rate limiting respecté (Yahoo Finance)
6. Cache des données (TTL 15 minutes)

#### Story 3.2: Calcul des indicateurs de tendance

> As a user,
> I want trend indicators calculated for stocks,
> so that I can identify market direction.

**Acceptance Criteria:**
1. Calcul SMA (20, 50, 200 périodes)
2. Calcul EMA (9, 21 périodes)
3. Endpoint `GET /api/stocks/:symbol/indicators` inclut ces indicateurs
4. Tests unitaires validant les calculs vs valeurs de référence
5. Indicateurs stockés en base pour historique

#### Story 3.3: Calcul des indicateurs de momentum et volatilité

> As a user,
> I want momentum and volatility indicators,
> so that I can assess stock dynamics.

**Acceptance Criteria:**
1. Calcul RSI (14 périodes)
2. Calcul MACD (12, 26, 9)
3. Calcul Bollinger Bands (20, 2)
4. Calcul OBV (On-Balance Volume)
5. Calcul Volume moyen 20 jours
6. Tous inclus dans l'endpoint indicators
7. Tests unitaires pour chaque indicateur

#### Story 3.4: Job de mise à jour des données

> As a user,
> I want market data to update automatically,
> so that I always have recent information.

**Acceptance Criteria:**
1. Job cron `updateMarketData` enregistré dans SchedulerService
2. Exécution toutes les 15 minutes pendant heures de marché
3. Mise à jour des prix et indicateurs pour toutes les actions surveillées
4. Gestion des erreurs avec logging détaillé
5. Logs de progression et statistiques

---

### Epic 4: Scoring & Screening

**Objectif** : Implémenter le système de score composite et le screener permettant de filtrer les actions selon des critères techniques.

#### Story 4.1: Calcul du score composite

> As a user,
> I want a composite score for each stock,
> so that I can quickly identify opportunities.

**Acceptance Criteria:**
1. Service `ScoringService` implémentant la formule :
   - Tendance LT (25%) : position vs SMA200
   - Tendance MT (20%) : position vs SMA50
   - Momentum (20%) : RSI + MACD
   - Volume (15%) : vs moyenne 20j
   - Sentiment (10%) : basé sur news récentes
   - Proximité support (10%) : distance aux supports
2. Score normalisé 0-100
3. Endpoint `GET /api/stocks/:symbol/score` retourne le détail
4. Tests unitaires avec scénarios variés

#### Story 4.2: API Screener avec filtres

> As a user,
> I want to filter stocks by technical criteria,
> so that I can find stocks matching my strategy.

**Acceptance Criteria:**
1. Endpoint `GET /api/screener` avec query params :
   - `minScore`, `maxScore`
   - `minRsi`, `maxRsi`
   - `aboveSma50`, `aboveSma200`
   - `minVolume`
   - `market` (US, EU, ALL)
2. Pagination (limit, offset)
3. Tri par score, symbol, ou tout indicateur
4. Réponse < 500ms pour 500 actions
5. Tests d'intégration

#### Story 4.3: Gestion de l'univers d'actions

> As a user,
> I want to define which stocks to monitor,
> so that I can focus on relevant markets.

**Acceptance Criteria:**
1. Table `Universe` : symbol, market, sector, active
2. Endpoint `POST /api/universe` pour ajouter des actions
3. Endpoint `DELETE /api/universe/:symbol` pour retirer
4. Import bulk via CSV (symboles S&P 500, CAC 40, etc.)
5. Limite : 500 actions max actives simultanément

---

### Epic 5: Alerts & Notifications

**Objectif** : Créer le système d'alertes basé sur les stratégies définies, avec notifications email et/ou push.

#### Story 5.1: Moteur d'alertes et stratégies

> As a user,
> I want alerts based on my trading strategies,
> so that I don't miss buying opportunities.

**Acceptance Criteria:**
1. Table `AlertRule` : strategy, params, enabled
2. Implémentation des 3 stratégies :
   - Pullback sur tendance haussière
   - Breakout avec volume
   - Croisement MACD
3. Table `Alert` : symbol, strategy, score, triggeredAt, acknowledged
4. Job cron évaluant les règles toutes les 15 minutes
5. Déduplication : pas d'alerte répétée dans les 24h

#### Story 5.2: Notifications email

> As a user,
> I want email notifications for alerts,
> so that I'm informed even when not using the app.

**Acceptance Criteria:**
1. Service `NotificationService` avec provider email (Nodemailer/SMTP)
2. Template email HTML avec détails de l'alerte
3. Configuration SMTP via variables d'environnement
4. Option enable/disable par utilisateur
5. Logs des emails envoyés

#### Story 5.3: Notifications push navigateur

> As a user,
> I want browser push notifications,
> so that I get instant alerts when the app is open.

**Acceptance Criteria:**
1. Service Worker configuré pour push notifications
2. Permission demandée au premier lancement
3. Notification affiche : symbol, stratégie, score
4. Clic sur notification → page détail de l'action
5. Option enable/disable dans settings

#### Story 5.4: Configuration des alertes

> As a user,
> I want to configure my alert preferences,
> so that I receive only relevant notifications.

**Acceptance Criteria:**
1. Page Settings > Alerts dans le frontend
2. Toggle par stratégie (enable/disable)
3. Seuil de score minimum pour alerte
4. Choix canaux : email, push, les deux
5. Horaires silencieux (optionnel)
6. Sauvegarde via API `PUT /api/settings/alerts`

---

### Epic 6: Dashboard & Visualization

**Objectif** : Construire l'interface utilisateur complète : dashboard, graphiques interactifs, screener UI, watchlist, et page détail action.

#### Story 6.1: Dashboard principal

> As a user,
> I want a dashboard showing key information at a glance,
> so that I can quickly assess the market situation.

**Acceptance Criteria:**
1. Widget Alertes actives (liste des 10 dernières)
2. Widget Top Opportunités (5 meilleurs scores)
3. Widget Résumé Portfolio (total value, daily P&L)
4. Widget Watchlist condensée (mini-list avec scores)
5. Refresh automatique via WebSocket
6. Style terminal/geek avec couleurs néon

#### Story 6.2: Graphiques interactifs

> As a user,
> I want interactive candlestick charts with indicators,
> so that I can analyze stock price action.

**Acceptance Criteria:**
1. TradingView Lightweight Charts intégré
2. Graphique chandeliers japonais
3. Overlay indicateurs : SMA, EMA, Bollinger Bands
4. Panneau séparé : RSI, MACD, Volume
5. Zoom, pan, crosshair fonctionnels
6. Timeframes : 1D, 1W, 1M, 3M, 1Y
7. Style dark avec couleurs néon

#### Story 6.3: Page Screener

> As a user,
> I want a filterable table of stocks,
> so that I can find opportunities matching my criteria.

**Acceptance Criteria:**
1. Tableau TanStack Table avec toutes les colonnes
2. Filtres en header : score, RSI, SMA, volume, marché
3. Tri par clic sur colonnes
4. Pagination (50 par page)
5. Clic sur ligne → page détail
6. Export CSV des résultats filtrés
7. Performance fluide avec 500 lignes

#### Story 6.4: Page Watchlist

> As a user,
> I want to manage my watchlist,
> so that I can track specific stocks closely.

**Acceptance Criteria:**
1. Liste des actions en watchlist avec mini-charts sparkline
2. Score et variation du jour affichés
3. Drag & drop pour réorganiser
4. Bouton ajouter (recherche par symbol)
5. Bouton supprimer avec confirmation
6. Alertes spécifiques par action (prix cible)

#### Story 6.5: Page Détail Action

> As a user,
> I want a detailed view for each stock,
> so that I can make informed decisions.

**Acceptance Criteria:**
1. Header : symbol, nom, prix, variation, score
2. Graphique interactif (composant Story 6.2)
3. Tableau indicateurs techniques avec valeurs
4. Section News IBKR récentes
5. Historique des alertes pour cette action
6. Bouton "Ajouter à watchlist"
7. Lien externe vers IBKR pour passer l'ordre

#### Story 6.6: Page Portfolio (lecture seule)

> As a user,
> I want to see my IBKR portfolio,
> so that I can track my positions alongside opportunities.

**Acceptance Criteria:**
1. Tableau des positions : symbol, qty, avgCost, current, P&L
2. Résumé : valeur totale, P&L jour, P&L total
3. Graphique répartition sectorielle (pie chart)
4. Refresh manuel + auto toutes les 5 min
5. Indicateur connexion IBKR (connecté/déconnecté)
6. **Aucun bouton d'action** (lecture seule stricte)

---

## 7. Out of Scope

Les éléments suivants sont explicitement exclus du MVP :

- Exécution d'ordres (contrainte permanente)
- Trading automatisé
- Backtesting
- Options et produits dérivés
- Marchés crypto, forex, matières premières
- Application mobile native
- Multi-utilisateurs / authentification
- Machine learning avancé

---

## 8. Risks and Mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Yahoo Finance API instable | Perte données de marché | Fallback vers Alpha Vantage/Finnhub |
| IB Gateway complexe à configurer | Blocage intégration | Documentation détaillée, tests manuels |
| Données EU limitées | Couverture partielle | Prioriser marché US, explorer EODHD |
| Faux positifs alertes élevés | Perte de confiance | Tuning progressif des seuils |

---

## 9. Next Steps

### 9.1 UX Expert Prompt

> Utilise ce PRD pour créer les wireframes et le design system de Looptrading. Focus sur l'esthétique "geek/terminal" avec dark mode exclusif, typographie monospace, et palette néon (vert #00ff41, cyan #00d4ff, magenta #ff00ff). Priorise le dashboard et la page détail action.

### 9.2 Architect Prompt

> Utilise ce PRD pour créer le document d'architecture technique de Looptrading. Le stack est défini (React, Fastify, Prisma, node-cron). Focus sur : structure du monorepo, schéma de base de données détaillé, intégration IB Gateway en lecture seule, et architecture du système d'alertes temps réel.

---

*Document généré par Sarah, Product Owner - Looptrading Project*
*Version 1.0 - Janvier 2026*
