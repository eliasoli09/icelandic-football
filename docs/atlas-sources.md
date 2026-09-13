# Icelandic football atlas: source register

Research snapshot: **12 September 2026**, season **2026**, senior **men’s** teams. This register accompanies `web/src/lib/atlas/clubs.json` and the unmodified official crest PNGs in `web/public/atlas/badges/`.

## Scope and membership

The two current KSÍ tournament tables, rather than historical team records, determine inclusion:

- [Besta deild karla 2026](https://www.ksi.is/oll-mot/mot?id=7025510): Víkingur R., Fram, KR, Breiðablik, ÍA, Keflavík, Stjarnan, Valur, FH, Þór, KA, ÍBV.
- [Lengjudeild karla 2026](https://www.ksi.is/oll-mot/mot?id=7025540): Afturelding, Þróttur R., Fylkir, HK, Njarðvík, Leiknir R., ÍR, Grótta, Vestri, Völsungur, Grindavík, Ægir.

The atlas contains 12 + 12 = 24 clubs. Database identifiers come from `data/seed/sql/01_teams.sql`; this atlas does not introduce new database teams.

## Stadium method and important distinctions

Home-ground names were checked against each club’s 2026 KSÍ results page. Latitude and longitude are the numeric location pins in the **Sjá staðsetningu** Google Maps links published on KSÍ’s stadium register. They identify the stadium site, not the city centroid. Coordinate precision reflects the published register and is not a claim of survey accuracy. All pins use the official current ground location except the documented same-site alias for Völsungur below.

- **Stjarnan:** the last two completed home league games shown on the snapshot (23 August and 6 September) are at **Miðgarður**. Earlier matches were at Samsungvöllurinn. This atlas uses the latest played home venue and says so in the visible fact, rather than claiming that Miðgarður is the club’s permanent historic stadium. [KSÍ results](https://www.ksi.is/oll-mot/mot/lid?id=5730&competitionId=7025510&banner-tab=matches&toggle=results); [municipal description of Miðgarður](https://www.gardabaer.is/ithrottir-og-tomstundir/ithrottamannvirki/midgardur-vetrarmyri).
- **Miðgarður coordinate cross-check:** the KSÍ pin, 64.0866894, -21.8871863, falls inside [OpenStreetMap building 888010846](https://www.openstreetmap.org/way/888010846), identified as Miðgarður, Vetrarbraut 30, Garðabær, with sports-centre and soccer tags. The building outline was checked through the [OSM map API](https://www.openstreetmap.org/api/0.6/map?bbox=-21.89,64.085,-21.884,64.089) on 12 September 2026. This independently corroborates the municipal Vetrarmýri description. [Samsungvöllurinn’s separate KSÍ entry](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=3914) is at 64.0873937, -21.9288981, approximately 2 km west. The atlas retains the published Miðgarður coordinate.
- **Grindavík:** the 2026 league home results name **Stakkavíkurvöllur**, whose KSÍ ground record explicitly says Grindavík and links to 63.8444744, -22.4293309. This is distinct from **Stakkavíkurvöllur–Safamýri**, used during the club’s displacement. The municipal 2025 evacuation plan also identifies Stakkavíkurvöllur in Grindavík. The atlas therefore places the club in Grindavík for this snapshot. [KSÍ results](https://www.ksi.is/oll-mot/mot/lid?id=5963&competitionId=7025540&banner-tab=matches&toggle=results); [ground record](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4472).
- **Völsungur:** **GPG völlurinn** is the 2026 sponsor name. Its new KSÍ record lacks coordinates, so the pin comes from the older **Húsavíkurvöllur** record at the same club ground. The club’s own 2025 Christmas publication states that the football grounds change to the GPG name on 1 January 2026. [Sponsor announcement, club publication](https://www.volsungur.is/static/files/jolablod/volsungur_jolablad_2025.pdf); [Húsavíkurvöllur coordinates](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=3683).
- **Þróttur R.:** the latest 2026 home results use **PEPSI völlurinn**; earlier results use AVIS völlurinn. Both register entries have the same coordinates in Laugardalur.
- **ÍBV:** `founded: 1903` denotes the football lineage explicitly used in the club’s own account. The visible fact distinguishes that lineage from the formation of the present ÍBV sports club in December 1996. [Club history](https://www.ibvsport.is/page/ibv).
- **HK:** uses the club’s officially documented formal foundation year **1970**, while its football department began in 1992. **Vestri:** uses the present sports club’s foundation year **2016**; its predecessor teams have an older history.

## Crests and colors

Every crest was retrieved from the KSÍ COMET file URL already registered in `data/seed/sql/08_team_colors.sql`. All 24 responses are genuine PNG images and were saved byte-for-byte, without redrawing, AI generation, resizing, or recoloring. Twenty-three have an alpha channel; Grótta’s official source image is RGB with a white background. The `color` values retain the existing application’s crest accent colors; these are presentation colors, not an authoritative claim about a home kit. Club marks remain the property of their respective owners; the download does not imply a license to reuse them in unrelated branding.

## Per-club evidence

Each JSON `sources` list preserves the exact league page, club results, stadium record, history or fact references, and original crest URL. The table below makes the principal claims easy to audit.

| Club | 2026 league | Ground and coordinate source | History / fact evidence |
| --- | --- | --- | --- |
| Víkingur R. | Besta | [Víkingsvöllur](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4250) · 64.1169710, -21.8526562 | [source 1](https://soguvefur.vikingur.is/sagan-i-mali-og-myndum/axel-andresson/) |
| Fram | Besta | [Lambhagavöllurinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4439) · 64.1316131, -21.7366489 | [source 1](https://fram.is/2022/06/21/nytt-ithrottasvaedi-fram-i-ulfarsardal-tekid-i-notkun/); [source 2](https://fram.is/is/) |
| KR | Besta | [Meistaravellir](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4013) · 64.1463325, -21.9674041 | [source 1](https://www.kr.is/knattspyrna); [source 2](https://www.kr.is/stefnur-og-l%C3%B6g) |
| Breiðablik | Besta | [Eikarvöllurinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=7822) · 64.1040889, -21.8967254 | [source 1](https://arsskyrsla2023.ksi.is/forsida/evropukeppnir/); [source 2](https://breidablik.is/um-okkur/saga-felagsins/) |
| ÍA | Besta | [ELKEM völlurinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4502) · 64.3176088, -22.0597666 | [source 1](https://ia.is/80-ara-afmaeli/) |
| Keflavík | Besta | [HS Orku völlurinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4029) · 63.9979968, -22.5586295 | [source 1](https://knattspyrna.keflavik.is/saga/islandsmot); [source 2](https://www.keflavik.is/almennt/frettir/keflavik-ithrotta--og-ungmennafelag-75-ara) |
| Stjarnan | Besta | [Miðgarður](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=3993) · 64.0866894, -21.8871863 | [source 1](https://www.stjarnan.is/saga-stjrnunnar); [source 2](https://www.gardabaer.is/ithrottir-og-tomstundir/ithrottamannvirki/midgardur-vetrarmyri) |
| Valur | Besta | [N1-völlurinn Hlíðarenda](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4437) · 64.1327705, -21.9234363 | [source 1](https://www.valur.is/um-val/saga.aspx) |
| FH | Besta | [Kaplakrikavöllur](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=3719) · 64.0757704, -21.9383545 | [source 1](https://fh.is/afmaelispistill-fra-formanni-fh/) |
| Þór | Besta | [VÍS völlurinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4499) · 65.6905041, -18.1190415 | [source 1](https://www.thorsport.is/handbolti/moya/news/raudir-og-hvitir-i-79-ar) |
| KA | Besta | [Greifavöllurinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4260) · 65.6775073, -18.1158916 | [source 1](https://www.ka.is/is/um-ka/frettir/stofnfundargerd-ka-8-januar-1928); [source 2](https://www.ka.is/is/um-ka/frettir/ka_dagurinn_a_laugardag_-_felagid_82_ara_thann_8_januar) |
| ÍBV | Besta | [Hásteinsvöllur](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4232) · 63.4393981, -20.2886969 | [source 1](https://www.ibvsport.is/page/ibv) |
| Afturelding | Lengjudeild | [Malbikstöðin að Varmá](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4035) · 64.1691215, -21.6854254 | [source 1](https://afturelding.is/frjalsar/saga-deildarinnar/) |
| Þróttur R. | Lengjudeild | [PEPSI völlurinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=7957) · 64.1415359, -21.8776901 | [source 1](https://trottur.is/sagan/) |
| Fylkir | Lengjudeild | [tekk VÖLLURINN](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4569) · 64.1134450, -21.7927475 | [source 1](https://fylkir.is/fotbolti-flokkar-2/); [source 2](https://www.fylkir.is/felagid) |
| HK | Lengjudeild | [Kórinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4083) · 64.0825397, -21.8250783 | [source 1](https://www.hk.is/is/um-hk/saga-felagsins) |
| Njarðvík | Lengjudeild | [JBÓ völlurinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4552) · 63.9903090, -22.5628808 | [source 1](https://www.umfn.is/wp-content/uploads/2019/08/adalfundur-2018-UMFN.pdf); [source 2](https://www.umfn.is/sagan/) |
| Leiknir R. | Lengjudeild | [Leiknisvöllur](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=3826) · 64.1023160, -21.8202430 | [source 1](https://www.leiknir.com/felagid/sagan/) |
| ÍR | Lengjudeild | [Þarfaþingsvöllurinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=7744) · 64.1040982, -21.8502895 | [source 1](https://ir.is/wp-content/uploads/2017/03/Saga_IR_1568.pdf); [source 2](https://ir.is/ir_news/ir-119-ara/) |
| Grótta | Lengjudeild | [Vivaldivöllurinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4191) · 64.1501580, -21.9957283 | [source 1](https://grotta.is/um-felagid/) |
| Vestri | Lengjudeild | [Kerecisvöllurinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4503) · 66.0728027, -23.1360027 | [source 1](https://www.vestri.is/vestri/log_vestra/) |
| Völsungur | Lengjudeild | [GPG völlurinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=7315) · 66.0499623, -17.3441812 | [source 1](https://saga.volsungur.is/stofnun/); [source 2](https://www.volsungur.is/static/files/jolablod/volsungur_jolablad_2025.pdf); [source 3](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=3683) |
| Grindavík | Lengjudeild | [Stakkavíkurvöllur](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4472) · 63.8444744, -22.4293309 | [source 1](https://umfg.is/category/adalstjorn/); [source 2](https://www.grindavik.is/gogn/2025/Grindav%C3%ADkurv%C3%B6llur%20-%20R%C3%BDmingar%C3%A1%C3%A6tlun%2008_05_2025.pdf) |
| Ægir | Lengjudeild | [GeoSalmo völlurinn](https://www.ksi.is/felagslid/knattspyrnuvellir/vollur?id=4479) · 63.8513024, -21.3827122 | [source 1](https://aegirfc.is/um-aegi/sagan/) |

## Validation

- Exactly 24 records, 12 for each league; no duplicated identifiers or slugs.
- All 24 expected badge files exist and decode as PNG.
- Every coordinate is finite and inside Iceland’s geographic bounds.
- Every visible historical fact has primary club, KSÍ, or municipal evidence linked in its record.
- The atlas is a dated editorial snapshot. Match venues and sponsor names can change; the linked KSÍ match record is the reference for a particular fixture.
