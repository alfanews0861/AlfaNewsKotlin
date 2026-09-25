const fs = require('fs');
const path = require('path');

const officialFeeds = [
    // State-level
    { handle: "@APPOLICE100", name: "ఆంధ్రప్రదేశ్ పోలీస్ - DGP (Andhra Pradesh State Police)", district: "", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@IPR_AP", name: "సమాచార పౌర సంబంధాల శాఖ ఆంధ్రప్రదేశ్ (I&PR Andhra Pradesh)", district: "", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@wearewithyou_ap", name: "ఆంధ్రప్రదేశ్ ప్రభుత్వం (AP Government Official Information)", district: "", state: "Andhra Pradesh", category: "స్థానిక" },

    // 1. అల్లూరి సీతారామరాజు
    { handle: "@Collector_ASR", name: "కలెక్టర్ అల్లూరి సీతారామరాజు (District Collector Alluri Sitharama Raju)", district: "అల్లూరి సీతారామరాజు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@asrpolice100", name: "అల్లూరి సీతారామరాజు జిల్లా ఎస్పీ (ASR District Police / SP)", district: "అల్లూరి సీతారామరాజు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_asr", name: "డిపిఆర్ఓ అల్లూరి సీతారామరాజు (DPRO Alluri Sitharama Raju I&PR)", district: "అల్లూరి సీతారామరాజు", state: "Andhra Pradesh", category: "స్థానిక" },

    // 2. అనకాపల్లి
    { handle: "@Collector_AKP", name: "కలెక్టర్ అనకాపల్లి (District Collector Anakapalli)", district: "అనకాపల్లి", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@AKPPolice", name: "అనకాపల్లి జిల్లా ఎస్పీ (Anakapalli District Police / SP)", district: "అనకాపల్లి", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_akp", name: "డిపిఆర్ఓ అనకాపల్లి (DPRO Anakapalli I&PR)", district: "అనకాపల్లి", state: "Andhra Pradesh", category: "స్థానిక" },

    // 3. అనంతపురం
    { handle: "@Collector_Atp", name: "కలెక్టర్ అనంతపురం (District Collector Anantapur)", district: "అనంతపురం", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@AnantapurPolice", name: "అనంతపురం జిల్లా ఎస్పీ (Anantapur District Police / SP)", district: "అనంతపురం", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_atp", name: "డిపిఆర్ఓ అనంతపురం (DPRO Anantapur I&PR)", district: "అనంతపురం", state: "Andhra Pradesh", category: "స్థానిక" },

    // 4. అన్నమయ్య
    { handle: "@Collector_ANM", name: "కలెక్టర్ అన్నమయ్య (District Collector Annamayya)", district: "అన్నమయ్య", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@AnnamayyaPolice", name: "అన్నమయ్య జిల్లా ఎస్పీ (Annamayya District Police / SP)", district: "అన్నమయ్య", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_anm", name: "డిపిఆర్ఓ అన్నమయ్య (DPRO Annamayya I&PR)", district: "అన్నమయ్య", state: "Andhra Pradesh", category: "స్థానిక" },

    // 5. బాపట్ల
    { handle: "@Collector_BPT", name: "కలెక్టర్ బాపట్ల (District Collector Bapatla)", district: "బాపట్ల", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@BapatlaPolice", name: "బాపట్ల జిల్లా ఎస్పీ (Bapatla District Police / SP)", district: "బాపట్ల", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_bpt", name: "డిపిఆర్ఓ బాపట్ల (DPRO Bapatla I&PR)", district: "బాపట్ల", state: "Andhra Pradesh", category: "స్థానిక" },

    // 6. చిత్తూరు
    { handle: "@collectorctr", name: "కలెక్టర్ చిత్తూరు (District Collector Chittoor)", district: "చిత్తూరు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ChittoorPolice", name: "చిత్తూరు జిల్లా ఎస్పీ (Chittoor District Police / SP)", district: "చిత్తూరు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_ctr", name: "డిపిఆర్ఓ చిత్తూరు (DPRO Chittoor I&PR)", district: "చిత్తూరు", state: "Andhra Pradesh", category: "స్థానిక" },

    // 7. కోనసీమ
    { handle: "@Collector_KNS", name: "కలెక్టర్ డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ (District Collector Konaseema)", district: "కోనసీమ", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@KonaseemaPolice", name: "కోనసీమ జిల్లా ఎస్పీ (Konaseema District Police / SP)", district: "కోనసీమ", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_kns", name: "డిపిఆర్ఓ కోనసీమ (DPRO Konaseema I&PR)", district: "కోనసీమ", state: "Andhra Pradesh", category: "స్థానిక" },

    // 8. తూర్పు గోదావరి
    { handle: "@Collector_EG", name: "కలెక్టర్ తూర్పు గోదావరి (District Collector East Godavari)", district: "తూర్పు గోదావరి", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@EGDISTPOLICE", name: "తూర్పు గోదావరి జిల్లా ఎస్పీ (East Godavari District Police / SP)", district: "తూర్పు గోదావరి", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_eg", name: "డిపిఆర్ఓ తూర్పు గోదావరి (DPRO East Godavari I&PR)", district: "తూర్పు గోదావరి", state: "Andhra Pradesh", category: "స్థానిక" },

    // 9. ఏలూరు
    { handle: "@Collector_ELR", name: "కలెక్టర్ ఏలూరు (District Collector Eluru)", district: "ఏలూరు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@SpEluruDistrict", name: "ఏలూరు జిల్లా ఎస్పీ (Eluru District Police / SP)", district: "ఏలూరు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_elr", name: "డిపిఆర్ఓ ఏలూరు (DPRO Eluru I&PR)", district: "ఏలూరు", state: "Andhra Pradesh", category: "స్థానిక" },

    // 10. గుంటూరు
    { handle: "@CollectorGuntr", name: "కలెక్టర్ గుంటూరు (District Collector Guntur)", district: "గుంటూరు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@GunturSP", name: "గుంటూరు జిల్లా ఎస్పీ (Guntur District Police / SP)", district: "గుంటూరు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_gnt", name: "డిపిఆర్ఓ గుంటూరు (DPRO Guntur I&PR)", district: "గుంటూరు", state: "Andhra Pradesh", category: "స్థానిక" },

    // 11. కాకినాడ
    { handle: "@Collector_KKD", name: "కలెక్టర్ కాకినాడ (District Collector Kakinada)", district: "కాకినాడ", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@KAKINADAPOLICE", name: "కాకినాడ జిల్లా ఎస్పీ (Kakinada District Police / SP)", district: "కాకినాడ", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_kkd", name: "డిపిఆర్ఓ కాకినాడ (DPRO Kakinada I&PR)", district: "కాకినాడ", state: "Andhra Pradesh", category: "స్థానిక" },

    // 12. కృష్ణా
    { handle: "@Collector_Kri", name: "కలెక్టర్ కృష్ణా (District Collector Krishna)", district: "కృష్ణా", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@krishnapoliceap", name: "కృష్ణా జిల్లా ఎస్పీ (Krishna District Police / SP)", district: "కృష్ణా", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_kri", name: "డిపిఆర్ఓ కృష్ణా (DPRO Krishna I&PR)", district: "కృష్ణా", state: "Andhra Pradesh", category: "స్థానిక" },

    // 13. కర్నూలు
    { handle: "@Collector_Knl", name: "కలెక్టర్ కర్నూలు (District Collector Kurnool)", district: "కర్నూలు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@PoliceKurnool", name: "కర్నూలు జిల్లా ఎస్పీ (Kurnool District Police / SP)", district: "కర్నూలు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_knl", name: "డిపిఆర్ఓ కర్నూలు (DPRO Kurnool I&PR)", district: "కర్నూలు", state: "Andhra Pradesh", category: "స్థానిక" },

    // 14. నంద్యాల
    { handle: "@Collector_NDL", name: "కలెక్టర్ నంద్యాల (District Collector Nandyal)", district: "నంద్యాల", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@NandyalSp", name: "నంద్యాల జిల్లా ఎస్పీ (Nandyal District Police / SP)", district: "నంద్యాల", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_ndl", name: "డిపిఆర్ఓ నంద్యాల (DPRO Nandyal I&PR)", district: "నంద్యాల", state: "Andhra Pradesh", category: "స్థానిక" },

    // 15. ఎన్టీఆర్
    { handle: "@Collector_NTR", name: "కలెక్టర్ ఎన్టీఆర్ జిల్లా (District Collector NTR District)", district: "ఎన్టీఆర్", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@VjaCityPolice", name: "విజయవాడ సిటీ పోలీస్ కమిషనరేట్ (Vijayawada City Police / NTR)", district: "ఎన్టీఆర్", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_vja", name: "డిపిఆర్ఓ విజయవాడ / ఎన్టీఆర్ (DPRO Vijayawada NTR I&PR)", district: "ఎన్టీఆర్", state: "Andhra Pradesh", category: "స్థానిక" },

    // 16. పల్నాడు
    { handle: "@Collector_PLD", name: "కలెక్టర్ పల్నాడు (District Collector Palnadu)", district: "పల్నాడు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@Palnadu_Police", name: "పల్నాడు జిల్లా ఎస్పీ (Palnadu District Police / SP)", district: "పల్నాడు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_pld", name: "డిపిఆర్ఓ పల్నాడు (DPRO Palnadu I&PR)", district: "పల్నాడు", state: "Andhra Pradesh", category: "స్థానిక" },

    // 17. పార్వతీపురం మన్యం
    { handle: "@Collector_PVM", name: "కలెక్టర్ పార్వతీపురం మన్యం (District Collector Parvathipuram Manyam)", district: "పార్వతీపురం మన్యం", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@PVPManyamPolice", name: "పార్వతీపురం మన్యం జిల్లా ఎస్పీ (Parvathipuram Manyam Police / SP)", district: "పార్వతీపురం మన్యం", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_pvm", name: "డిపిఆర్ఓ పార్వతీపురం మన్యం (DPRO Parvathipuram Manyam I&PR)", district: "పార్వతీపురం మన్యం", state: "Andhra Pradesh", category: "స్థానిక" },

    // 18. ప్రకాశం
    { handle: "@Collector_Pkm", name: "కలెక్టర్ ప్రకాశం (District Collector Prakasam)", district: "ప్రకాశం", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@prakasam_police", name: "ప్రకాశం జిల్లా ఎస్పీ (Prakasam District Police / SP)", district: "ప్రకాశం", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_pkm", name: "డిపిఆర్ఓ ప్రకాశం (DPRO Prakasam I&PR)", district: "ప్రకాశం", state: "Andhra Pradesh", category: "స్థానిక" },

    // 19. శ్రీ పొట్టి శ్రీరాములు నెల్లూరు
    { handle: "@Collector_Nlr", name: "కలెక్టర్ శ్రీ పొట్టి శ్రీరాములు నెల్లూరు (District Collector Nellore)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@sp_nlr", name: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు ఎస్పీ (Nellore District Police / SP)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_nlr", name: "డిపిఆర్ఓ నెల్లూరు (DPRO Nellore I&PR)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", state: "Andhra Pradesh", category: "స్థానిక" },

    // 20. శ్రీ సత్యసాయి
    { handle: "@Collector_SSS", name: "కలెక్టర్ శ్రీ సత్యసాయి (District Collector Sri Sathya Sai)", district: "శ్రీ సత్యసాయి", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@SSSPOLICE12", name: "శ్రీ సత్యసాయి జిల్లా ఎస్పీ (Sri Sathya Sai District Police / SP)", district: "శ్రీ సత్యసాయి", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_sss", name: "డిపిఆర్ఓ శ్రీ సత్యసాయి (DPRO Sri Sathya Sai I&PR)", district: "శ్రీ సత్యసాయి", state: "Andhra Pradesh", category: "స్థానిక" },

    // 21. శ్రీకాకుళం
    { handle: "@Collector_Skl", name: "కలెక్టర్ శ్రీకాకుళం (District Collector Srikakulam)", district: "శ్రీకాకుళం", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@SRIKAKULMPOLICE", name: "శ్రీకాకుళం జిల్లా ఎస్పీ (Srikakulam District Police / SP)", district: "శ్రీకాకుళం", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_skl", name: "డిపిఆర్ఓ శ్రీకాకుళం (DPRO Srikakulam I&PR)", district: "శ్రీకాకుళం", state: "Andhra Pradesh", category: "స్థానిక" },

    // 22. తిరుపతి
    { handle: "@Collector_Tpt", name: "కలెక్టర్ తిరుపతి (District Collector Tirupati)", district: "తిరుపతి", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@tirupatipolice", name: "తిరుపతి జిల్లా ఎస్పీ (Tirupati District Police / SP)", district: "తిరుపతి", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_tpt", name: "డిపిఆర్ఓ తిరుపతి (DPRO Tirupati I&PR)", district: "తిరుపతి", state: "Andhra Pradesh", category: "స్థానిక" },

    // 23. విశాఖపట్నం
    { handle: "@Collector_Vsp", name: "కలెక్టర్ విశాఖపట్నం (District Collector Visakhapatnam)", district: "విశాఖపట్నం", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@vizagcitypolice", name: "విశాఖపట్నం సిటీ పోలీస్ కమిషనరేట్ (Visakhapatnam City Police)", district: "విశాఖపట్నం", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_vsp", name: "డిపిఆర్ఓ విశాఖపట్నం (DPRO Visakhapatnam I&PR)", district: "విశాఖపట్నం", state: "Andhra Pradesh", category: "స్థానిక" },

    // 24. విజయనగరం
    { handle: "@Collector_Vzm", name: "కలెక్టర్ విజయనగరం (District Collector Vizianagaram)", district: "విజయనగరం", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@PoliceVzm", name: "విజయనగరం జిల్లా ఎస్పీ (Vizianagaram District Police / SP)", district: "విజయనగరం", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_vzm", name: "డిపిఆర్ఓ విజయనగరం (DPRO Vizianagaram I&PR)", district: "విజయనగరం", state: "Andhra Pradesh", category: "స్థానిక" },

    // 25. పశ్చిమ గోదావరి
    { handle: "@Collector_WG", name: "కలెక్టర్ పశ్చిమ గోదావరి (District Collector West Godavari)", district: "పశ్చిమ గోదావరి", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@Police_WG", name: "పశ్చిమ గోదావరి జిల్లా ఎస్పీ (West Godavari District Police / SP)", district: "పశ్చిమ గోదావరి", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_wg", name: "డిపిఆర్ఓ పశ్చిమ గోదావరి (DPRO West Godavari I&PR)", district: "పశ్చిమ గోదావరి", state: "Andhra Pradesh", category: "స్థానిక" },

    // 26. వైఎస్ఆర్ కడప
    { handle: "@Collector_YSR", name: "కలెక్టర్ వైఎస్ఆర్ కడప (District Collector YSR Kadapa)", district: "వైఎస్ఆర్ కడప", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@Kadapa_Police", name: "వైఎస్ఆర్ కడప జిల్లా ఎస్పీ (YSR Kadapa District Police / SP)", district: "వైఎస్ఆర్ కడప", state: "Andhra Pradesh", category: "స్థానిక" },
    { handle: "@ddipr_cdp", name: "డిపిఆర్ఓ వైఎస్ఆర్ కడప (DPRO YSR Kadapa I&PR)", district: "వైఎస్ఆర్ కడప", state: "Andhra Pradesh", category: "స్థానిక" }
];

const targetPath = path.join(__dirname, '..', 'andhra_official_feeds.json');
fs.writeFileSync(targetPath, JSON.stringify(officialFeeds, null, 2), 'utf8');
console.log(`Successfully generated andhra_official_feeds.json with ${officialFeeds.length} feeds!`);
