# Project Brief: Looptrading

## Executive Summary

**Looptrading** est une application web responsive de swing trading semi-automatisé destinée à un usage personnel. L'objectif principal est de recevoir des **alertes d'achat d'actions** au meilleur moment, en combinant analyse technique, suivi de tendance et surveillance des actualités financières.

- **Marchés cibles :** Actions US et Europe
- **Approche :** Swing trading (positions sur plusieurs jours/semaines)
- **Broker :** Interactive Brokers (IBKR)
- **Valeur clé :** Centraliser tous les outils d'analyse et d'alerte dans une interface unique et personnalisée

---

## Problem Statement

### Situation actuelle

Les traders individuels font face à plusieurs défis :

- **Fragmentation des outils** : Graphiques sur TradingView, news sur Bloomberg/Reuters, screeners sur Finviz, exécution sur le broker - tout est dispersé
- **Surcharge d'information** : Trop de données brutes, pas assez de signaux actionnables
- **Coût des solutions intégrées** : Les plateformes professionnelles (Bloomberg Terminal, Refinitiv) coûtent des milliers d'euros/mois
- **Manque de personnalisation** : Les outils existants ne permettent pas de créer des alertes basées sur ses propres critères combinés

### Impact

- Opportunités manquées par manque de réactivité
- Décisions sous-optimales par manque de vue d'ensemble
- Temps perdu à jongler entre différentes plateformes

### Pourquoi maintenant

- APIs de données financières de plus en plus accessibles
- Interactive Brokers offre une API robuste et gratuite pour ses clients
- Node.js et les frameworks modernes permettent de construire rapidement des applications performantes

---

## Proposed Solution

**Looptrading** est une plateforme web personnelle qui centralise :

1. **Screening intelligent** - Filtrer les actions selon des critères techniques personnalisés
2. **Analyse visuelle** - Graphiques interactifs avec indicateurs techniques
3. **Veille automatisée** - Agrégation des news et analyse de sentiment
4. **Alertes proactives** - Notifications quand une opportunité d'achat se présente
5. **Backtesting** - Valider ses stratégies sur données historiques
6. **Exécution intégrée** - Connexion directe à Interactive Brokers

### Différenciateurs

- **Sur-mesure** : Construit selon vos critères et préférences exactes
- **Gratuit** : Utilisation d'APIs gratuites/open source autant que possible
- **Intégré** : Tout dans une seule interface
- **Local** : Données et configuration sous votre contrôle total

---

## Target Users

### Profil utilisateur unique

| Attribut | Description |
|----------|-------------|
| **Identité** | Vous - trader individuel |
| **Expérience** | Connaissances de base en trading |
| **Style** | Swing trading (jours à semaines) |
| **Marchés** | Actions US et Europe |
| **Objectif** | Identifier les meilleures opportunités d'achat |
| **Disponibilité** | Consultation quotidienne, pas de monitoring constant |
| **Broker** | Interactive Brokers (compte existant) |

### Besoins principaux

- Recevoir des alertes claires et actionnables
- Comprendre rapidement pourquoi une action est recommandée
- Visualiser les données techniques facilement
- Suivre la performance de son portefeuille

---

## Goals & Success Metrics

### Objectifs business

- Centraliser 100% du workflow de trading dans une seule application
- Réduire le temps de recherche quotidien de 50%
- Ne plus manquer d'opportunités correspondant à ses critères

### Métriques de succès utilisateur

- Temps moyen pour identifier une opportunité : < 5 minutes
- Taux de faux positifs des alertes : < 20%
- Satisfaction globale avec l'outil : utilisation quotidienne

### KPIs techniques

- **Disponibilité** : 99% (hébergement local, dépend de votre machine)
- **Latence données** : < 15 minutes de délai (limitation APIs gratuites)
- **Temps de chargement** : < 3 secondes pour le dashboard

---

## MVP Scope

### Core Features (Must Have)

| Fonctionnalité | Description | Priorité |
|----------------|-------------|----------|
| **Screener d'actions** | Filtrage par critères techniques (RSI, MACD, moyennes mobiles, volume) sur marchés US/EU | P0 |
| **Graphiques interactifs** | Chandeliers japonais avec indicateurs techniques superposables | P0 |
| **Système d'alertes** | Notifications push quand critères d'achat réunis | P0 |
| **Agrégateur de news** | Flux RSS/API des principales sources financières | P0 |
| **Connexion IBKR** | Récupération portefeuille, passage d'ordres | P0 |
| **Dashboard principal** | Vue d'ensemble : alertes, positions, P&L, watchlist | P0 |

### Features importantes (Should Have)

| Fonctionnalité | Description | Priorité |
|----------------|-------------|----------|
| **Analyse de sentiment** | Score basé sur news et réseaux sociaux | P1 |
| **Backtesting basique** | Tester une stratégie sur données historiques | P1 |
| **Suivi P&L détaillé** | Performance par position, graphiques d'évolution | P1 |
| **Watchlist personnalisée** | Liste de surveillance avec alertes spécifiques | P1 |

### Out of Scope pour MVP

- Trading automatisé (exécution automatique sans validation)
- Options et produits dérivés
- Marchés crypto, forex, matières premières
- Application mobile native
- Multi-utilisateurs / authentification
- Machine learning avancé pour prédictions

### Critères de succès MVP

Le MVP est réussi si :
1. Le screener identifie correctement les actions correspondant aux critères définis
2. Les alertes arrivent en temps voulu (< 15 min de délai)
3. L'exécution d'ordres via IBKR fonctionne sans erreur
4. L'interface est utilisable quotidiennement sans friction majeure

---

## Post-MVP Vision

### Phase 2 - Améliorations

- **Alertes avancées** : Conditions multi-critères complexes, alertes sur patterns chartistes
- **Sentiment amélioré** : Intégration Twitter/Reddit, analyse NLP plus poussée
- **Backtesting avancé** : Optimisation de paramètres, walk-forward analysis
- **Rapports** : Génération de rapports PDF de performance

### Phase 3 - Extensions

- **Application mobile** : PWA ou app native pour alertes en mobilité
- **Autres marchés** : Crypto, ETFs, futures si intérêt
- **Stratégies automatisées** : Exécution automatique avec garde-fous

### Vision long terme

Une plateforme de trading personnelle complète qui évolue avec vos besoins et stratégies, tout en restant sous votre contrôle total.

---

## Technical Considerations

### Platform Requirements

| Aspect | Spécification |
|--------|---------------|
| **Type** | Application web responsive |
| **Navigateurs** | Chrome, Firefox, Safari (dernières versions) |
| **Responsive** | Desktop-first, adapté tablette et mobile |
| **Performance** | Chargement initial < 3s, updates temps réel fluides |
| **Hébergement** | Local (votre machine) |

### Architecture recommandée

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (SPA)                           │
│  React/Vue + TailwindCSS + TradingView Lightweight Charts       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js)                           │
│  Express/Fastify + WebSocket Server + Job Scheduler             │
└─────────────────────────────────────────────────────────────────┘
          │                   │                    │
          ▼                   ▼                    ▼
┌─────────────┐    ┌─────────────────┐    ┌──────────────┐
│   SQLite/   │    │   APIs Données  │    │  IBKR API    │
│  PostgreSQL │    │   Financières   │    │  (TWS/Gateway)│
└─────────────┘    └─────────────────┘    └──────────────┘
```

### Stack technique recommandée

#### Backend (Node.js)

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Framework** | **Fastify** | Plus performant qu'Express, TypeScript natif |
| **ORM** | **Prisma** | Type-safe, migrations faciles, excellent DX |
| **Base de données** | **SQLite** (dev) / **PostgreSQL** (prod) | SQLite suffisant pour usage personnel |
| **Job scheduler** | **BullMQ** + Redis | Tâches planifiées (fetch données, calcul alertes) |
| **WebSocket** | **Socket.io** | Updates temps réel vers le frontend |
| **Validation** | **Zod** | Validation de schémas TypeScript |

#### Frontend

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Framework** | **React 18** | Écosystème riche, communauté active (choix validé) |
| **Build tool** | **Vite** | Développement rapide, HMR instantané |
| **Styling** | **TailwindCSS** | Utility-first, prototypage rapide |
| **Charts** | **TradingView Lightweight Charts** | Gratuit, performant, spécialisé finance |
| **State** | **Zustand** | Simple, léger, TypeScript natif |
| **Tables** | **TanStack Table** | Tri, filtres, pagination performants |
| **HTTP** | **TanStack Query** | Cache, revalidation, état serveur |

#### APIs de données financières (gratuites/freemium)

| Service | Données | Limites gratuites |
|---------|---------|-------------------|
| **Yahoo Finance** (via yfinance) | Prix, historique, fondamentaux | Illimité (non-officiel) |
| **Alpha Vantage** | Prix, indicateurs techniques | 25 req/jour |
| **Finnhub** | Prix temps réel, news, sentiment | 60 req/min |
| **Polygon.io** | Données US complètes | 5 req/min (gratuit) |
| **EODHD** | Données EU + US | Limité gratuit |
| **NewsAPI** | Agrégation news | 100 req/jour |

#### Interactive Brokers API

| Option | Description |
|--------|-------------|
| **TWS API** | Connexion via Trader Workstation (doit être ouvert) |
| **IB Gateway** | Headless, plus léger que TWS |
| **Client Portal API** | REST API (nécessite authentification web) |
| **Librairie Node.js** | `@stoqey/ib` - wrapper TypeScript pour TWS API |

**Recommandation** : Utiliser IB Gateway + `@stoqey/ib` pour une intégration robuste.

### Structure de projet suggérée

```
looptrading/
├── apps/
│   ├── web/                 # Frontend React/Vue
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   └── utils/
│   │   └── package.json
│   └── api/                 # Backend Node.js
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── jobs/
│       │   ├── integrations/
│       │   │   ├── ibkr/
│       │   │   ├── yahoo/
│       │   │   └── news/
│       │   └── utils/
│       └── package.json
├── packages/
│   └── shared/              # Types et utilitaires partagés
├── docker-compose.yml       # Redis, PostgreSQL (optionnel)
├── package.json             # Workspace root
└── turbo.json               # Turborepo config
```

**Recommandation** : Utiliser un monorepo avec **Turborepo** ou **Nx** pour gérer frontend + backend.

---

## Constraints & Assumptions

### Contraintes

| Type | Contrainte |
|------|------------|
| **Budget** | Gratuit (APIs gratuites, pas d'infra cloud) |
| **Hébergement** | Local uniquement (votre machine doit être allumée) |
| **Latence données** | 15+ minutes de délai (APIs gratuites) |
| **Données EU** | Plus difficiles à obtenir gratuitement |
| **IBKR** | Nécessite TWS ou IB Gateway en cours d'exécution |
| **Utilisateur unique** | Pas de système d'authentification |

### Hypothèses clés

- Vous avez un compte Interactive Brokers actif avec accès API
- Votre machine locale peut rester allumée pendant les heures de marché
- Un délai de 15 minutes sur les données est acceptable pour du swing trading
- Vous êtes à l'aise avec l'installation de logiciels (Node.js, Docker optionnel)
- Les données Yahoo Finance (non-officielles) restent disponibles

---

## Risks & Open Questions

### Risques identifiés

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| **Yahoo Finance bloqué** | Perte source principale de données | Moyenne | Prévoir fallback Alpha Vantage/Finnhub |
| **Changement API IBKR** | Ordres ne fonctionnent plus | Faible | Suivre changelog IBKR, tests réguliers |
| **Données EU insuffisantes** | Couverture partielle marché européen | Élevée | Prioriser marché US, explorer EODHD |
| **Faux positifs alertes** | Signaux non pertinents | Moyenne | Backtesting, ajustement critères |
| **Complexité IBKR API** | Intégration difficile | Moyenne | Utiliser librairie `@stoqey/ib`, documentation |

### Questions ouvertes

1. ~~Quels indicateurs techniques précis ?~~ **RÉSOLU** - Voir section Indicateurs ci-dessous
2. ~~Quels critères d'alerte ?~~ **RÉSOLU** - Voir section Stratégies d'alerte ci-dessous
3. **Quelles sources de news** consultez-vous actuellement ?
4. ~~Quel niveau de détail pour l'analyse de sentiment ?~~ **RÉSOLU** - Score simple intégré au score composite
5. ~~React ou Vue ?~~ **RÉSOLU** - React

### Indicateurs techniques retenus

| Catégorie | Indicateur | Paramètres |
|-----------|------------|------------|
| Tendance | SMA | 20, 50, 200 jours |
| Tendance | EMA | 9, 21 jours |
| Momentum | RSI | 14 périodes |
| Momentum | MACD | 12, 26, 9 |
| Volatilité | Bollinger Bands | 20, 2 |
| Volume | Volume moyen | 20 jours |
| Volume | OBV | - |

### Stratégies d'alerte retenues

**Stratégie principale : Pullback sur tendance haussière**
- Prix > SMA 200 (tendance LT haussière)
- Prix touche ou passe sous SMA 50 (pullback)
- RSI < 40 mais > 30 (survente modérée)
- Volume inférieur à la moyenne (pas de panique)
- Signal : RSI remonte au-dessus de 40

**Stratégie secondaire : Breakout avec volume**
- Bollinger Bands en squeeze
- Cassure de la bande supérieure
- Volume > 150% moyenne 20 jours
- MACD histogramme positif et croissant

**Stratégie tertiaire : Croisement MACD**
- Prix > SMA 50
- MACD croise au-dessus du signal près de zéro
- RSI entre 40 et 60

**Score composite (0-100) :**
- Tendance LT (25%) + Tendance MT (20%) + Momentum (20%) + Volume (15%) + Sentiment (10%) + Proximité support (10%)
- Alerte forte : Score > 75
- À surveiller : Score 60-75

### Recherches complémentaires nécessaires

- [ ] Tester les limites réelles des APIs gratuites sur marchés EU
- [ ] Valider le workflow d'authentification IB Gateway
- [ ] Explorer les options de données temps réel abordables
- [ ] Benchmark des librairies de calcul d'indicateurs techniques (technicalindicators, talib)

---

## Appendices

### A. APIs et ressources utiles

**Données de marché :**
- [Yahoo Finance (yfinance)](https://github.com/ranaroussi/yfinance)
- [Alpha Vantage](https://www.alphavantage.co/)
- [Finnhub](https://finnhub.io/)
- [Polygon.io](https://polygon.io/)

**Interactive Brokers :**
- [IBKR API Documentation](https://interactivebrokers.github.io/tws-api/)
- [@stoqey/ib - Node.js client](https://github.com/stoqey/ib)
- [IB Gateway](https://www.interactivebrokers.com/en/trading/ibgateway-stable.php)

**Charts :**
- [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/)

**Indicateurs techniques :**
- [technicalindicators](https://github.com/anandanand84/technicalindicators)
- [talib-binding](https://github.com/AnyChart/talib-binding)

### B. Stack Frontend retenue

**React 18** avec :
- Vite (build tool)
- TailwindCSS (styling)
- Zustand (state management)
- TanStack Query (data fetching)
- TanStack Table (tableaux)
- TradingView Lightweight Charts (graphiques)

---

## Next Steps

### Actions immédiates

1. **Valider ce cahier des charges** - Relire et confirmer les priorités
2. **Répondre aux questions ouvertes** - Définir critères d'alertes précis
3. **Choisir le framework frontend** - React ou Vue
4. **Créer le repository** - Initialiser le monorepo avec la structure proposée
5. **Configurer IB Gateway** - Tester la connexion API

### Prochaine étape projet

Ce Project Brief peut être transmis à un **Product Owner** pour générer un PRD (Product Requirements Document) détaillé avec user stories et critères d'acceptation.

---

*Document généré par Mary, Business Analyst - Looptrading Project*
*Version 1.0 - Janvier 2026*
