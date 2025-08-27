# API for simulation

## Heart Attack

```bash
curl -X POST "http://localhost:3000/override" \
     -H "Content-Type: application/json" \
     -d '{"heart_rate": 195, "spo2": 88, "stress_level": 10}'
```

## Reset to normal

```bash
curl -X POST "http://localhost:3000/reset"
```

## Small Alert SMS

```bash
curl -X POST "http://localhost:3000/override" \
     -H "Content-Type: application/json" \
     -d '{"heart_rate": 105, "spo2": 96, "stress_level": 5}'
```
