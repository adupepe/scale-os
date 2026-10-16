# SCALE/OS

Eksperymentalna aplikacja growth intelligence do portfolio. Łączy narracyjny frontend z działającym modelem scenariuszy i zapisem strategii.

## Uruchomienie

```bash
python3 server.py
```

Otwórz `http://localhost:8001`.

## Struktura produktu

- `/` — strona główna i wyjaśnienie wartości
- `/system.html` — architektura systemu
- `/signals.html` — sygnały i kolejka decyzji
- `/simulation.html` — interaktywny model scenariuszy
- `/pricing.html` — plany i porównanie funkcji

## API

- `GET /api/health`
- `GET /api/metrics`
- `POST /api/simulate`
- `POST /api/strategies`

Projekt nie wymaga zewnętrznych zależności Python.
