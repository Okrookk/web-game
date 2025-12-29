# Kriteerien Tarkistus

## ✅ Täyttyvät Kriteerit

### Pakolliset:
- ✅ Playable characters (pelaajat liikkuvat ja ampuvat)
- ✅ Equal chance of winning (kaikilla sama mahdollisuus)
- ✅ Multiplayer 2-4 players
- ✅ Real-time visibility (kaikki näkevät toisensa)
- ✅ Select/type player name
- ✅ Unique player name
- ✅ Lead player starts game
- ✅ RequestAnimationFrame käytössä
- ✅ No HTML canvas (käytetään DOM:ia)
- ✅ Pause menu (pause/resume/quit)
- ✅ Player name displayed on pause/resume/quit
- ✅ RequestAnimationFrame unaffected by pause
- ✅ Scoring/lives system
- ✅ See all opponents scores/lives
- ✅ Real-time score/lives updates
- ✅ Winner displayed at end
- ✅ Timer (countdown + game timer)
- ✅ Same timer for all players

### Extra:
- ✅ Keyboard control (WASD/Arrows + Space)
- ✅ Sound effects (music + effects)

## ⚠️ Tarkistettavat / Puuttuvat Kriteerit

### Pakolliset:
1. **Join from URL/IP** - Tällä hetkellä hardcoded `localhost:3000`
   - Pitää tehdä konfiguroitavaksi tai automaattinen hajotus
   - Tarvitaan deployment-ohjeet

2. **60 FPS minimum** - ✅ Toteutettu:
   - Client renderöi 60 FPS requestAnimationFrame:llä (FPS counter näyttää tämän)
   - Server lähettää 60 FPS gameState-päivityksiä (tarpeeksi sujuvan renderöinnin kannalta)
   - Kriteeri viittaa renderöintinopeuteen, ei server update rateen

3. **No dropped frames** - Pitää testata:
   - Peli pitää testata pitkällä pelisessionilla
   - Varmistaa että ei ole frame droppeja

4. **No crashing / Stable gameplay** - Pitää testata:
   - Testata eri skenaarioita (disconnect, reconnect, jne.)
   - Varmistaa että peli ei kaadu

5. **No dropped frames when pausing** - Pitää tarkistaa:
   - Varmistaa että pause ei aiheuta frame droppeja

### Extra:
1. **Smooth keyboard input** - Pitää tarkistaa:
   - Varmistaa että ei ole input delayjä
   - Varmistaa että ei ole long-press glitchejä

2. **Minimal lag** - Optimointi:
   - Server lähettää 60 FPS (tarvitaan sujuvan renderöinnin kannalta)
   - Client renderöi 60 FPS requestAnimationFrame:llä
   - Vapaaehtoinen: Client-side interpolation jos halutaan vähentää verkkoliikennettä

3. **Beyond minimum** - Voitaisiin lisätä:
   - Power-ups (jo on HP flasks ja hearts)
   - Special abilities
   - Custom game modes
   - Enemmän vihollisia/tyyppejä
   - Boss-viholliset

4. **Visually pleasing** - Subjektiivista, mutta:
   - Pixel-art on hyvä
   - Voisi olla enemmän animaatioita
   - Voisi olla parempi UI

## 🔧 Korjausehdotukset

1. **URL/IP konfigurointi:**
   - Lisää environment variable tai config file
   - Automaattinen hajotus jos localhost

2. **Performance optimointi:**
   - Vähennä server update ratea 60 -> 30 FPS
   - Lisää throttling gameState lähetykselle
   - Optimoi renderer-logiikkaa

3. **Input optimointi:**
   - Varmista että input handling on optimoitu
   - Testaa eri nopeuksilla

4. **Lisäominaisuudet:**
   - Power-ups (speed boost, damage boost, jne.)
   - Special abilities (dash, shield, jne.)
   - Boss-viholliset
   - Enemmän vihollisia/tyyppejä

