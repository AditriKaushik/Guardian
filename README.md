# Guardian

A small, **consent-first** toolkit for keeping track of the people you look
after — children, parents, or any group. It gives you one simple method that
can **listen**, **view**, or **locate** a single person or a whole group.

## The one method

```python
from guardian import Guardian, Member, Group

# Who you're looking after, and what each person has agreed to.
sam  = Member("sam", "Sam", role="child").grant("locate", "view")
mom  = Member("mom", "Maria", role="parent").grant("locate")
family = Group("family").add(sam, mom)

g = Guardian()

g.monitor(sam,    mode="locate")   # one person -> one result
g.monitor(family, mode="locate")   # a group    -> a list of results
```

`mode` is one of:

| mode      | what it does                              |
|-----------|-------------------------------------------|
| `listen`  | capture / relay audio (a check-in call…)  |
| `view`    | capture / relay video or a still image    |
| `locate`  | report the member's current location      |

## Consent is built in

Listening to, viewing, or locating a person is sensitive, so Guardian **will
not do any of it unless that person has granted consent for that mode**. A
member who hasn't opted in is skipped with a clear, non-fatal result rather
than being tracked silently. This is what keeps Guardian a family-safety tool
and not a surveillance one.

```python
dad = Member("dad", "David")           # consented to nothing
r = g.monitor(dad, mode="locate")
r.ok       # False
r.error    # "'David' has not consented to 'locate'"
```

An `require_consent=False` override exists for genuine emergencies where you
are the accountable guardian with a lawful basis — use it deliberately.

> **Please note:** monitoring another person may be regulated where you live,
> especially for anyone who can legally consent for themselves. Get consent and
> check local law before deploying this.

## Plugging in real hardware

Guardian handles consent, group fan-out, and result packaging. The actual
capture is a *backend* callable you register per mode — a GPS reader, a camera,
a phone API:

```python
def read_gps(member, mode):
    return {"lat": 40.71, "lon": -74.00}

g = Guardian().register("locate", read_gps)
```

With no backend registered, `monitor` returns a clearly-marked stub so you can
wire the hardware in later.

## Tests

```bash
pip install -e ".[test]"
pytest
```

CI runs this on every push and pull request across Python 3.9–3.12.

## Practical use across your devices (hub + reporters)

To actually locate family members across phones and computers, run the
**Guardian hub** on one always-on machine and have each device report its own
location to it (consent + a per-device token required):

```bash
pip install -e .
cp examples/hub_config.example.json hub_config.json   # edit names + tokens
python -m guardian.hub --config hub_config.json --port 8080
# open http://<hub-ip>:8080/ to see everyone's last-known location
```

Each computer reports with `python -m guardian.reporter ...`; phones report with
a no-code Apple Shortcut (iOS) or the HTTP Shortcuts app (Android). Full
step-by-step for Windows, macOS, Android and iOS — plus why silent mic/camera
capture is not supported — is in [docs/USAGE_DEVICES.md](docs/USAGE_DEVICES.md).
