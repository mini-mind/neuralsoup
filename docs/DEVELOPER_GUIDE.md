# Developer Guide

## Architecture
Event-driven layered architecture with core logic separated from UI.

## Setup
```bash
npm install
npm run dev
npm run build
```

## Project Structure
```
src/
├── entities/       # Core neuron and synapse classes
├── services/       # State management and simulation
├── ui/            # React components and views
└── contexts/      # React contexts
```
