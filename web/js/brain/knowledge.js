/* नन्हा स्कूल — मिट्ठू's offline knowledge (NS.Knowledge).

   Pure data + matching: no DOM, no network, no storage. A classic script that works in the browser
   (NS.Knowledge) and in node:vm / CommonJS (module.exports). Loaded before brain.js.

     NS.Knowledge.answer(text, { lang: "hi"|"en"|"hinglish", ageBand: "2-3"|"4-5"|"6+", random })
       → { text, topic: "know:<intent>", intent, category, lang, followUp? }  or  null

   - Answers are true, warm and tiny: 1–2 very short sentences for 2–3 year olds, up to 3 for older
     children; never more than 220 characters. followUp is an optional playful question.
   - null means "not sure" — the caller's other layers (games, small talk, online AI) reply instead.
   - Never scary details, no medicine doses, brands, politics, romance or shaming. Sensitive questions
     (a pet that is gone, body privacy, where babies come from …) get one kind sentence and
     "talk to a grown-up". Personal details are never asked for or repeated.
   - The research it follows: young children's questions are mostly real requests for information
     (Chouinard 2007) — about animals (what they eat, where they live, their babies), their own body,
     how things work and why the world is as it is — and they learn best from short, direct answers.

   Data format (parsed once at load; see def()):
     @id [flags] kw,kw + kw,$MACRO [- negative,kw]
         groups are joined by " + " (all must match); keywords in a group by "," (any may match).
         Keywords match at the start of a word; "=kw" (and short ones) must be the whole word.
         flags: "?" needs a question/tell-me/like cue, "!" sensitive (no lead-in, no follow-up, never
         shortened), "*" always said whole (a joke needs its punchline, even for 2–3 year olds).
     h / e / g   the answer in Hindi / English / Hinglish (repeat the three lines for another phrasing).
                 The first sentence must work alone (2–3 year olds hear only that).
     f           a follow-up question: "hindi / english / hinglish"; "f -" = none (the answer asks already).
   Animal table (defAnimals): "~id emoji names" then h/e/g lines "eat#home#baby#fact#sound". */
(function (root) {
  "use strict";

  var LANGS = ["hi", "en", "hinglish"];
  var MAX = 220;          // every reply
  var MAX_YOUNG = 130;    // 2–3 year olds
  var YOUNG_TWO = 100;    // a second sentence for 2–3 only when both together stay this short
  function L(hi, en, hg) { return { hi: hi, en: en, hinglish: hg }; }

  /* ================= Normalisation (speech-to-text friendly) ================= */

  var EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{FE0F}\u{FE0E}\u{200D}\u{20E3}\u{1F1E6}-\u{1F1FF}]/gu;
  /* Hinglish spellings vary: paani/pani, neela/nila, phool/fool, hawa/hava, zyada/jyada, kutta/kuta. */
  function foldLatin(w) {
    return w.replace(/ph/g, "f").replace(/w/g, "v").replace(/z/g, "j").replace(/ee/g, "i").replace(/oo/g, "u")
      .replace(/chch/g, "ch").replace(/([a-z])\1+/g, "$1");
  }
  /* Lower-case; nukta dropped (ज़→ज); ँ→ं; ॉ→ा; long ई/ऊ folded into short (spelling slips); half न/म
     before a consonant → ं (हिन्दी = हिंदी); Devanagari digits → 0-9; emoji and punctuation → space. */
  function norm(s) {
    s = String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/\u093C/g, "").normalize("NFC");
    s = s.replace(/\u0901/g, "\u0902")                               // chandrabindu → anusvara
      .replace(/\u0949/g, "\u093E").replace(/\u0911/g, "\u0906")     // candra o → aa
      .replace(/\u0945/g, "\u0947").replace(/\u090D/g, "\u090F")     // candra e → e
      .replace(/\u0940/g, "\u093F").replace(/\u0942/g, "\u0941")     // long ii/uu matra → short
      .replace(/\u0908/g, "\u0907").replace(/\u090A/g, "\u0909")     // long II/UU vowel → short
      .replace(/[\u0919\u091E\u0923\u0928\u092E]\u094D(?=[\u0915-\u092D])/g, "\u0902")   // half n/m → anusvara
      .replace(/[\u200C\u200D]/g, "");
    s = s.replace(/[\u0966-\u096F]/g, function (d) { return String(d.charCodeAt(0) - 0x0966); });
    s = s.replace(/['’`]/g, "").replace(EMOJI, " ");
    s = s.replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
    return s.replace(/[a-z]+/g, function (w) { return foldLatin(ALIAS[w] || w); });
  }
  /* Hinglish words that folding would turn into English ones ("aam" → "am"). */
  var ALIAS = { aam: "mango", aamon: "mangoes", aamo: "mangoes" };

  /* A keyword matches only at the start of a word ("hi" never inside "this", "हां" never inside
     "कहां"). Short keywords (Latin ≤ 3 letters, Devanagari ≤ 2 code units) or "=kw" must also end
     at a word boundary ("sun" ≠ "sunday"). */
  var B = "[\\p{L}\\p{M}\\p{N}]";
  var KWC = {};
  function kw(k) {
    if (Object.prototype.hasOwnProperty.call(KWC, k)) return KWC[k];
    var whole = k.charAt(0) === "=";
    var n = norm(whole ? k.slice(1) : k);
    if (!n) return (KWC[k] = null);
    if (!whole) whole = /^[a-z0-9 ]+$/.test(n) ? n.length <= 3 : n.length <= 2;
    var esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (KWC[k] = { src: "(?<!" + B + ")" + esc + (whole ? "(?!" + B + ")" : ""), re: null,
      n: n, len: n.length, key: (whole ? "=" : "") + n });
  }
  /* Cheap substring check first; the word-edge regex is built only when it may match. */
  function kwTest(c, t) {
    if (t.indexOf(c.n) < 0) return false;
    if (!c.re) c.re = new RegExp(c.src, "u");
    return c.re.test(t);
  }
  function list(s) { return s.split(",").map(function (x) { return x.trim(); }).filter(Boolean); }

  /* Shared keyword groups. */
  var MACRO = {};
  function macro(name, s) { MACRO[name] = group(s); }
  function group(s) {
    var out = [];
    list(s).forEach(function (k) {
      if (k.charAt(0) === "$") {
        if (!MACRO[k.slice(1)]) throw new Error("knowledge: unknown macro " + k);
        out = out.concat(MACRO[k.slice(1)]);
      } else { var c = kw(k); if (c) out.push(c); }
    });
    return out;
  }
  macro("WHY", "क्यों,क्युं,क्यो,क्यु,कियों,किसलिए,काहे,why,=kyu,kyun,kyon,kiyon,kiyun,=kyo,kiun,kisliye,kahe");
  macro("HOW", "कैसे,कैसा,कैसी,how,kaise,kese,kaisa,kaisi,kaisey");
  macro("WHAT", "क्या,what,whats,=kya,=kia,kyaa,=kaun sa,कौन सा,कौनसा,which");
  macro("WHERE", "कहां,किधर,where,wheres,kahan,kidhar,kahaan");
  macro("WHEN", "कब,when,=kab");
  macro("WHO", "कौन,who,whos,kaun,koun,=kon");
  macro("TELL", "बताओ,बताइए,बता दो,बताना,समझाओ,सिखाओ,मतलब,बारे में,जानकारी,tell,explain,about,meaning,teach,batao,bataao,bata do,=bata,samjhao,sikhao,matlab,bare me,baare mein,bare mein");
  macro("MANY", "कितना,कितने,कितनी,how many,how much,how big,how long,kitna,kitne,kitni");
  macro("YN", "=do,=does,=can,=is,=are,=will,=did,=could,सकता,सकती,सकते,sakta,sakti,sakte,क्या");
  macro("LIKE", "पसंद,अच्छा लगता,अच्छी लगती,अच्छे लगते,प्यारा,प्यारी,=like,=likes,=love,=loves,favourite,favorite,pasand,achha lagta,achhi lagti,pyara,pyari");
  macro("Q", "$WHY,$HOW,$WHAT,$WHERE,$WHEN,$WHO,$TELL,$MANY,$YN");
  macro("CUE", "$Q,$LIKE");
  macro("EAT", "=खा,खाता,खाती,खाते,खाना,खाने,खाए,खाएं,भोजन,चारा,eat,eats,eating,food,=kha,khata,khati,khate,khana,khaana,khaate,khaata,khaati,chara");
  macro("LIVE", "रहता,रहती,रहते,रहत,घर,कहां,live,lives,living,home,house,stay,stays,rehta,rehti,rehte,rahta,rahti,rahte,ghar,kahan");
  macro("BABY", "बच्चा,बच्चे,बच्ची,बच्चों,शिशु,baby,babies,bacha,bache,bachi,bachcha,bachche,baccha,=young");
  macro("SOUND", "आवाज,=बोल,बोलता,बोलती,बोलते,sound,sounds,=say,says,noise,avaj,avaaz,=bol,bolta,bolti,bolte");
  macro("DO", "करता,करती,करते,करते हैं,काम,=do,=does,job,work,works,kaam,karta,karti,karte");
  macro("GUARD", "मुझे मारा,मुझको मारा,मारता है,मारती है,मारते हैं,पीटता,पीटती,पीटा,मुझे छुआ,छूता है,छूती है,गंदा स्पर्श,किसी को मत बताना,धमकी," +
    "hit me,hits me,hurt me,hurts me,beat me,beats me,touched me,touches me,touch me,mujhe mara,mujhe maara,marta hai,maarta hai,peet,pitai," +
    "dont tell anyone,keep it a secret,kisi ko mat batana,खून निकल,bleeding,बुखार,fever,bukhar,उल्टी,vomit,ulti");

  /* ================= Data ================= */

  var INTENTS = [], BY_ID = {}, CATS = {};
  function addIntent(it) {
    if (BY_ID[it.id]) throw new Error("knowledge: duplicate intent " + it.id);
    INTENTS.push(it); BY_ID[it.id] = it; CATS[it.cat] = (CATS[it.cat] || 0) + 1;
    return it;
  }
  function intentFrom(cat, s) {
    var m = s.match(/^(\S+)\s+(?:([?!*]+)\s+)?(.*)$/);
    if (!m) throw new Error("knowledge: bad header " + s);
    var spec = m[3], neg = null, i = spec.indexOf(" - ");
    if (i >= 0) { neg = group(spec.slice(i + 3)); spec = spec.slice(0, i); }
    var flags = m[2] || "";
    return { id: m[1], cat: cat, groups: spec.split(" + ").map(group), neg: neg,
      cue: flags.indexOf("?") >= 0, sens: flags.indexOf("!") >= 0, whole: flags.indexOf("*") >= 0,
      a: { hi: [], en: [], hinglish: [] }, f: null };
  }
  function fu(s) { var p = s.split(" / "); return L(p[0], p[1], p[2]); }
  function def(cat, txt) {
    var cur = null;
    txt.split("\n").forEach(function (line) {
      line = line.trim();
      if (!line || line.slice(0, 2) === "//") return;
      var tag = line.charAt(0), rest = line.slice(2).trim();
      if (tag === "@") cur = addIntent(intentFrom(cat, line.slice(1)));
      else if (tag === "h") cur.a.hi.push(rest);
      else if (tag === "e") cur.a.en.push(rest);
      else if (tag === "g") cur.a.hinglish.push(rest);
      else if (tag === "f") cur.f = rest === "-" ? false : fu(rest);
      else throw new Error("knowledge: bad line " + line);
    });
  }
  /* Animals: five intents each — what it eats, where it lives, its babies, its sound, and "tell me
     about it" (also "I like cats"). */
  function defAnimals(txt) {
    var cur = null;
    function mk(suffix, groups, cue) {
      var it = { id: cur.id + "_" + suffix, cat: "animals", groups: groups, neg: null, cue: !!cue, sens: false,
        a: { hi: [], en: [], hinglish: [] }, f: null };
      return addIntent(it);
    }
    txt.split("\n").forEach(function (line) {
      line = line.trim();
      if (!line || line.slice(0, 2) === "//") return;
      if (line.charAt(0) === "~") {
        var m = line.slice(1).match(/^(\S+)\s+(\S+)\s+(.*)$/);
        var names = group(m[3]);
        MACRO.ANIMALNAMES = (MACRO.ANIMALNAMES || []).concat(names);
        cur = { id: m[1], names: names };
        cur.eat = mk("eat", [names, MACRO.EAT]);
        cur.live = mk("home", [names, MACRO.LIVE], true);
        cur.baby = mk("baby", [names, MACRO.BABY]);
        cur.sound = mk("sound", [names, MACRO.SOUND]);
        cur.about = mk("about", [names], true);
        return;
      }
      var lang = { h: "hi", e: "en", g: "hinglish" }[line.charAt(0)];
      var p = line.slice(2).split("#").map(function (x) { return x.trim(); });
      cur.eat.a[lang].push(p[0]);
      cur.live.a[lang].push(p[1]);
      cur.baby.a[lang].push(p[2]);
      cur.sound.a[lang].push(p[4]);
      cur.about.a[lang].push(p[3] + " " + p[0] + " " + p[1]);
    });
  }

  macro("SUN", "सूरज,सूर्य,सुरज,sun,suraj,surya,sooraj,surajdada");
  macro("MOON", "=चांद,चंदा,चंद्रमा,चंदामामा,moon,=chand,chanda,chandrama,chandamama");
  macro("STAR", "तारे,तारा,तारों,सितारा,सितारे,star,stars,=tare,=tara,=taare,taron,sitara,sitare");
  macro("SKY", "आसमान,आकाश,असमान,अंबर,आस्मान,sky,skies,aasman,asman,aasmaan,asmaan,akash,aakash");
  macro("CLOUD", "बादल,मेघ,cloud,clouds,badal,baadal,=megh");
  macro("RAIN", "बारिश,बरसात,वर्षा,rain,raining,rains,rainy,barish,baarish,barsaat,barsat,varsha");
  macro("EARTH", "धरती,पृथ्वी,earth,dharti,prithvi,prithvee");
  macro("SEA", "समुद्र,सागर,समंदर,ocean,oceans,=sea,samudra,samundar,samandar");
  macro("NIGHT", "रात,night,nights,raat,=rat");
  macro("DAY", "=दिन,दिन में,=day,daytime,=din,din mein,दोपहर,dopahar");

  def("nature", `
@sky_blue $SKY + नील,blue,neela,nila,neele,nile
h हवा सूरज की नीली रोशनी को चारों तरफ़ फैला देती है, इसलिए आसमान नीला दिखता है! 🌤️ धूप में सारे रंग छिपे होते हैं, पर नीला सबसे ज़्यादा बिखरता है।
e The air spreads the sun's blue light all around, so the sky looks blue! 🌤️ Sunlight has every colour hidden in it, but blue bounces around the most.
g Hawa suraj ki neeli roshni ko chaaron taraf faila deti hai, isliye aasmaan neela dikhta hai! 🌤️ Dhoop mein saare rang chhupe hote hain, par neela sabse zyada bikharta hai.
h आसमान नीला इसलिए है क्योंकि हवा धूप के नीले रंग को सबसे ज़्यादा उछालती है! 💙 इसलिए जहाँ भी देखो, नीला ही नीला।
e The sky is blue because the air bounces the blue part of sunlight the most! 💙 So everywhere you look, you see blue.
g Aasmaan neela isliye hai kyunki hawa dhoop ke neele rang ko sabse zyada uchhaalti hai! 💙 Isliye jahan bhi dekho, neela hi neela.
@sky_night $SKY,अंधेरा,अंधेरे,=dark,andhera,andhere + $NIGHT,अंधेर,काला,काले,=dark,black,andhera,kala + $WHY,$HOW
h रात को हमारी धरती का हिस्सा सूरज से दूसरी तरफ़ घूम जाता है, इसलिए आसमान अँधेरा हो जाता है! 🌙 तब चाँद और तारे चमकते दिखते हैं।
e At night our side of the Earth turns away from the sun, so the sky gets dark! 🌙 That's when we can see the moon and stars shine.
g Raat ko hamari dharti ka hissa suraj se doosri taraf ghoom jaata hai, isliye aasmaan andhera ho jaata hai! 🌙 Tab chaand aur taare chamakte dikhte hain.
@sunset_colours $SKY,$SUN,शाम,evening,sunset,shaam + लाल,नारंगी,ऑरेंज,गुलाबी,orange,=red,pink,=laal,=lal,narangi,gulabi
h शाम को धूप हवा में लंबा रास्ता चलकर आती है, तो आसमान लाल-नारंगी हो जाता है! 🌇 नीला रंग रास्ते में ही बिखर जाता है।
e In the evening, sunlight travels a long way through the air, so the sky turns red and orange! 🌇 The blue gets scattered away on the journey.
g Shaam ko dhoop hawa mein lamba raasta chalkar aati hai, toh aasmaan laal-narangi ho jaata hai! 🌇 Neela rang raaste mein hi bikhar jaata hai.
@sun_hot $SUN + गर्म,गरम,hot,garam,garm,=आग,=fire,जलता,jalta,burn
h सूरज गैस का एक बहुत बड़ा, बहुत गर्म गोला है! ☀️ वो बहुत दूर है, इसलिए हम तक बस प्यारी-सी धूप पहुँचती है। उसे कभी सीधे मत देखना, आँखों को नुकसान होता है।
e The sun is a giant ball of super hot gas! ☀️ It is very far away, so only gentle sunshine reaches us. Never look straight at the sun, it can hurt your eyes.
g Suraj gas ka ek bahut bada, bahut garam gola hai! ☀️ Woh bahut door hai, isliye hum tak bas pyaari si dhoop pahunchti hai. Use kabhi seedhe mat dekhna, aankhon ko nuksaan hota hai.
@sun_what ? $SUN
h सूरज एक तारा है — हमारा सबसे पास वाला तारा! ☀️ वो हमें रोशनी और गर्मी देता है, जिससे पौधे उगते हैं।
e The sun is a star — the closest star to us! ☀️ It gives us light and warmth, and helps plants grow.
g Suraj ek taara hai — hamara sabse paas wala taara! ☀️ Woh humein roshni aur garmi deta hai, jisse paudhe ugte hain.
@sun_night $SUN + $NIGHT,कहां,where,kahan,जाता,चला जाता,jata,chala,goes,=go,छिप,chhip,chhup,hide
h सूरज कहीं नहीं जाता, हमारी धरती घूमती है! 🌍 रात को हम धरती के उस तरफ़ होते हैं जहाँ धूप नहीं पहुँचती। तब दूसरे देशों में दिन होता है!
e The sun doesn't go anywhere — our Earth turns around! 🌍 At night, our side of the Earth faces away from the sun. Then it's daytime in other countries!
g Suraj kahin nahi jaata, hamari dharti ghoomti hai! 🌍 Raat ko hum dharti ke us taraf hote hain jahan dhoop nahi pahunchti. Tab doosre deshon mein din hota hai!
@sun_rise $SUN,sunrise,sunset + उग,निकल,डूब,ढल,rise,rises,=set,sets,sunrise,sunset,ugta,nikalta,dubta,dhalta
h सुबह धरती घूमकर सूरज की तरफ़ आती है, तो लगता है सूरज उग रहा है! 🌅 शाम को हम दूर घूम जाते हैं, तो सूरज ढलता हुआ दिखता है।
e In the morning the Earth turns towards the sun, so it looks like the sun is rising! 🌅 In the evening we turn away, so the sun seems to set.
g Subah dharti ghoomkar suraj ki taraf aati hai, toh lagta hai suraj ug raha hai! 🌅 Shaam ko hum door ghoom jaate hain, toh suraj dhalta hua dikhta hai.
@day_night $DAY,$NIGHT + होती,होता,होते,आती,आता,=hoti,=hota,=hote,=aati,=aata,happen,happens,=come,comes,=have + $WHY,$HOW
h धरती लट्टू की तरह धीरे-धीरे घूमती है! 🌍 जो हिस्सा सूरज की तरफ़ होता है वहाँ दिन, और दूसरी तरफ़ रात होती है।
e The Earth spins slowly, like a top! 🌍 The side facing the sun has day, and the other side has night.
g Dharti lattu ki tarah dheere-dheere ghoomti hai! 🌍 Jo hissa suraj ki taraf hota hai wahan din, aur doosri taraf raat hoti hai.
@moon_what ? $MOON
h चाँद पत्थर की एक बड़ी गेंद जैसा है जो धरती के चारों ओर घूमता है! 🌙 उसकी अपनी रोशनी नहीं होती, वो सूरज की रोशनी से चमकता है।
e The moon is like a big rocky ball that goes around the Earth! 🌙 It has no light of its own — it shines with the sun's light.
g Chaand patthar ki ek badi gend jaisa hai jo dharti ke chaaron or ghoomta hai! 🌙 Uski apni roshni nahi hoti, woh suraj ki roshni se chamakta hai.
@moon_shape $MOON + बदल,आधा,आधे,पतला,पतली,गोल,घट,बढ,छोटा,छोटी,=बडा,=बडी,shape,shapes,change,changes,half,thin,smaller,bigger,badal,adha,aadha,=gol,patla,chhota,=bada
h चाँद बदलता नहीं, बस उसका जितना हिस्सा धूप में चमकता है, उतना हमें दिखता है! 🌓 इसलिए कभी पूरा गोल, कभी आधा, कभी पतली-सी मुस्कान।
e The moon doesn't really change — we just see the part the sun is lighting up! 🌓 So sometimes it's round, sometimes half, sometimes a thin smile.
g Chaand badalta nahi, bas uska jitna hissa dhoop mein chamakta hai, utna humein dikhta hai! 🌓 Isliye kabhi poora gol, kabhi aadha, kabhi patli si muskaan.
@moon_follow $MOON + पीछे,साथ,follow,follows,following,peeche,piche,saath,=sath,चलता,chalta
h चाँद बहुत-बहुत दूर है, इसलिए हम कितना भी चलें, वो उसी जगह दिखता है! 🌙 इसलिए लगता है जैसे वो हमारे साथ चल रहा हो।
e The moon is so far away that it seems to stay in the same spot even when we move! 🌙 So it looks like it's following us.
g Chaand bahut-bahut door hai, isliye hum kitna bhi chalein, woh usi jagah dikhta hai! 🌙 Isliye lagta hai jaise woh hamare saath chal raha ho.
@moon_day $MOON + $DAY,सुबह,morning,subah,धूप,dhoop
h हाँ, चाँद कभी-कभी दिन में भी आसमान में होता है! 🌙 बस धूप इतनी तेज़ होती है कि वो हल्का-सा दिखता है।
e Yes, the moon is sometimes in the sky during the day too! 🌙 It just looks pale because the sunshine is so bright.
g Haan, chaand kabhi-kabhi din mein bhi aasmaan mein hota hai! 🌙 Bas dhoop itni tez hoti hai ki woh halka sa dikhta hai.
@moon_light $MOON + रोशनी,चमक,उजाला,light,shine,shines,shining,glow,roshni,chamak,ujala
h चाँद सूरज की रोशनी को शीशे की तरह हम तक लौटा देता है! 🌕 उसकी अपनी कोई रोशनी नहीं होती।
e The moon bounces the sun's light back to us, a bit like a mirror! 🌕 It has no light of its own.
g Chaand suraj ki roshni ko sheeshe ki tarah hum tak lauta deta hai! 🌕 Uski apni koi roshni nahi hoti.
@moon_visit $MOON + जा सकते,जा सकता,जा सकती,जाना,गया,गए,पहुंच,रहता,रहते,रॉकेट,go,went,visit,live,lives,astronaut,rocket,ja sakte,ja sakta,jaana,gaya,gaye,rehta,rehte,pahunch
h हाँ, अंतरिक्ष यात्री रॉकेट से चाँद तक जा चुके हैं! 🚀 वहाँ साँस लेने वाली हवा नहीं है, इसलिए वो खास सूट और हेलमेट पहनते हैं। चाँद पर कोई नहीं रहता।
e Yes, astronauts have flown to the moon in rockets! 🚀 There's no air to breathe there, so they wear special suits and helmets. Nobody lives on the moon.
g Haan, astronaut rocket se chaand tak ja chuke hain! 🚀 Wahan saans lene wali hawa nahi hai, isliye woh khaas suit aur helmet pehente hain. Chaand par koi nahi rehta.
@star_twinkle $STAR + टिमटिम,चमक,twinkle,twinkles,twinkling,shine,timtim,chamak
h तारों की रोशनी हिलती हुई हवा से होकर आती है, इसलिए तारे टिमटिमाते दिखते हैं! ✨ असल में तारे सूरज जैसे बड़े, गर्म गोले हैं, बस बहुत दूर।
e Starlight wiggles as it comes through the moving air, so stars look twinkly! ✨ Stars are really big hot balls like our sun, just very far away.
g Taaron ki roshni hilti hui hawa se hokar aati hai, isliye taare timtimate dikhte hain! ✨ Asal mein taare suraj jaise bade, garam gole hain, bas bahut door.
@star_what ? $STAR
h तारे बहुत बड़े, चमकते गोले हैं, बिल्कुल हमारे सूरज जैसे! ⭐ वो इतने दूर हैं कि छोटे-छोटे दिखते हैं।
e Stars are giant glowing balls, just like our sun! ⭐ They are so far away that they look tiny.
g Taare bahut bade, chamakte gole hain, bilkul hamare suraj jaise! ⭐ Woh itne door hain ki chhote-chhote dikhte hain.
@star_count $STAR + $MANY,गिन,count,=gin
h आसमान में इतने सारे तारे हैं कि कोई भी सारे गिन नहीं सकता! ✨ आज रात तुम कितने गिन पाओगे?
e There are so many stars that nobody can count them all! ✨ How many can you count tonight?
g Aasmaan mein itne saare taare hain ki koi bhi saare gin nahi sakta! ✨ Aaj raat tum kitne gin paoge?
@star_day $STAR + $DAY,सुबह,morning,subah
h तारे दिन में भी आसमान में होते हैं! ⭐ बस सूरज की तेज़ रोशनी में वो छिप जाते हैं।
e The stars are still in the sky during the day! ⭐ The bright sunshine just hides them.
g Taare din mein bhi aasmaan mein hote hain! ⭐ Bas suraj ki tez roshni mein woh chhip jaate hain.
@shooting_star $STAR,टूटता तारा,उल्का,shooting star,falling star,tuta tara + टूट,गिरते,गिरता,shooting,falling,=fall,falls,toot,tut,girte,girta
h टूटता तारा असल में तारा नहीं होता! 🌠 वो अंतरिक्ष का एक नन्हा पत्थर होता है जो हवा में आते ही चमक उठता है।
e A shooting star isn't really a star! 🌠 It's a tiny space pebble that glows as it zooms into our air.
g Toot-ta taara asal mein taara nahi hota! 🌠 Woh antariksh ka ek nanha patthar hota hai jo hawa mein aate hi chamak uthta hai.
@rain_why ? $RAIN,पानी क्यों गिर,पानी कहां से गिर
h बादलों की नन्ही बूँदें मिलकर भारी हो जाती हैं, तो नीचे गिरती हैं — यही बारिश है! 🌧️ बादल पानी की बूँदों से ही बनते हैं।
e Tiny drops in the clouds join up, get heavy and fall down — that's rain! 🌧️ Clouds are made of water drops.
g Baadalon ki nanhi boondein milkar bhaari ho jaati hain, toh neeche girti hain — yahi baarish hai! 🌧️ Baadal paani ki boondon se hi bante hain.
h बारिश बादलों से आती है! ☁️ सूरज समुद्र और नदियों के पानी को भाप बनाकर ऊपर भेजता है, वही बादल बनकर फिर बरसता है।
e Rain comes from the clouds! ☁️ The sun warms water from seas and rivers into vapour, it rises up, makes clouds and falls again as rain.
g Baarish baadalon se aati hai! ☁️ Suraj samudra aur nadiyon ke paani ko bhaap banakar upar bhejta hai, wahi baadal bankar phir barasta hai.
@rain_smell $RAIN + खुशबू,गंध,महक,सौंधी,smell,smells,khushbu,mehak,saundhi
h बारिश की बूँदें सूखी मिट्टी पर गिरती हैं, तो प्यारी-सी खुशबू आती है! 🌧️ इसे मिट्टी की सौंधी खुशबू कहते हैं।
e When raindrops fall on dry soil, they make a lovely earthy smell! 🌧️ It's the smell of happy soil.
g Baarish ki boondein sookhi mitti par girti hain, toh pyaari si khushboo aati hai! 🌧️ Ise mitti ki saundhi khushboo kehte hain.
@rainbow इंद्रधनुष,सतरंगी,rainbow,rainbows,indradhanush,satrangi
h जब धूप बारिश की बूँदों से होकर निकलती है, तो उसके सात रंग अलग-अलग दिखते हैं — यही इंद्रधनुष है! 🌈 लाल, नारंगी, पीला, हरा, नीला, जामुनी और बैंगनी।
e When sunshine passes through raindrops, its seven colours spread out — that's a rainbow! 🌈 Red, orange, yellow, green, blue, indigo and violet.
g Jab dhoop baarish ki boondon se hokar nikalti hai, toh uske saat rang alag-alag dikhte hain — yahi indradhanush hai! 🌈 Laal, narangi, peela, hara, neela, jamuni aur baingani.
@cloud_what ? $CLOUD
h बादल पानी की बहुत छोटी-छोटी बूँदों से बनते हैं! ☁️ वो इतनी हल्की होती हैं कि हवा में तैरती रहती हैं।
e Clouds are made of teeny tiny drops of water! ☁️ They are so light that they float in the air.
g Baadal paani ki bahut chhoti-chhoti boondon se bante hain! ☁️ Woh itni halki hoti hain ki hawa mein tairti rehti hain.
@cloud_move $CLOUD + =चल,चलते,चलता,उड,भाग,move,moves,moving,=go,chalte,chalta,udte,bhaag
h बादलों को हवा धक्का देकर इधर-उधर ले जाती है! ☁️ हवा तेज़ हो, तो बादल भी जल्दी-जल्दी भागते हैं।
e The wind pushes the clouds along! ☁️ When the wind is fast, the clouds race across the sky.
g Baadalon ko hawa dhakka dekar idhar-udhar le jaati hai! ☁️ Hawa tez ho, toh baadal bhi jaldi-jaldi bhaagte hain.
@cloud_dark $CLOUD + काले,काला,सलेटी,grey,gray,dark,black,kale,kala
h जब बादल में बहुत सारा पानी भर जाता है, तो वो घना और काला दिखता है! 🌧️ मतलब जल्दी ही बारिश आने वाली है।
e When a cloud fills up with lots of water, it looks thick and dark! 🌧️ That means rain is coming soon.
g Jab baadal mein bahut saara paani bhar jaata hai, toh woh ghana aur kaala dikhta hai! 🌧️ Matlab jaldi hi baarish aane wali hai.
@thunder गरज,गडगड,थंडर,बादल गरज,thunder,thundering,garaj,gadgad,=गर्जन
h गड़गड़ाहट आसमान की बिजली की आवाज़ होती है! ⛈️ बिजली हवा को बहुत तेज़ी से गर्म करती है, तो हवा ज़ोर से धड़ाम बोलती है। ये बस आवाज़ है, घर के अंदर हम सुरक्षित हैं।
e Thunder is the sound lightning makes! ⛈️ Lightning heats the air so fast that the air goes BOOM. It's just a sound — we are safe inside the house.
g Gadgadahat aasmaan ki bijli ki awaaz hoti hai! ⛈️ Bijli hawa ko bahut tezi se garam karti hai, toh hawa zor se dhadaam bolti hai. Yeh bas awaaz hai, ghar ke andar hum surakshit hain.
@lightning lightning,बिजली चमक,बिजली कडक,कडकती बिजली,चमकती बिजली,आसमान की बिजली,आसमानी बिजली,bijli chamak,bijli kadak,chamakti bijli,kadakti bijli
h आसमान की बिजली बादलों में बनी एक बहुत बड़ी चिंगारी होती है! ⚡ बिजली चमके तो घर के अंदर बड़ों के पास रहना।
e Lightning is a giant spark made inside the clouds! ⚡ When there's lightning, stay inside the house with a grown-up.
g Aasmaan ki bijli baadalon mein bani ek bahut badi chingari hoti hai! ⚡ Bijli chamke toh ghar ke andar badon ke paas rehna.
@wind ? हवा,पवन,wind,windy,breeze,=hava,pavan,=air
h हवा हमारे चारों ओर है — दिखती नहीं, पर महसूस होती है! 💨 सूरज हवा को गर्म करता है, तो वो इधर-उधर बहने लगती है।
e Air is all around us — we can't see it, but we can feel it! 💨 When the sun warms the air, it starts moving, and that's wind.
g Hawa hamare chaaron or hai — dikhti nahi, par mehsoos hoti hai! 💨 Suraj hawa ko garam karta hai, toh woh idhar-udhar behne lagti hai.
@storm आंधी,तूफान,चक्रवात,storm,storms,stormy,toofan,tufan,andhi,cyclone
h तूफ़ान में बहुत तेज़ हवा और बारिश आती है! 🌬️ तब घर के अंदर बड़ों के पास रहना सबसे अच्छा है। फिर तूफ़ान चला जाता है और धूप लौट आती है।
e A storm brings very strong wind and rain! 🌬️ The best place is inside the house with a grown-up. Then the storm passes and the sun comes back.
g Toofaan mein bahut tez hawa aur baarish aati hai! 🌬️ Tab ghar ke andar badon ke paas rehna sabse achha hai. Phir toofaan chala jaata hai aur dhoop laut aati hai.
@winter सर्दी,सर्दियों,ठंड,जाडा,जाडे,winter,sardi,sardiyon,thand,jada,jaada + $WHY,मौसम,season,mausam,आती,आता,aati,aata,comes
h सर्दियों में धूप हम तक तिरछी होकर आती है, इसलिए कम गर्मी मिलती है! ❄️ तब स्वेटर और गरम-गरम खाना कितना अच्छा लगता है।
e In winter, sunshine reaches us at a slant, so it doesn't warm us as much! ❄️ That's when cosy sweaters feel so nice.
g Sardiyon mein dhoop hum tak tirchhi hokar aati hai, isliye kam garmi milti hai! ❄️ Tab sweater aur garam-garam khaana kitna achha lagta hai.
@summer गर्मी,गर्मियों,गरमी,summer,garmi,garmiyon + $WHY,मौसम,season,mausam,आती,aati,comes
h गर्मियों में धूप हम पर सीधी पड़ती है, इसलिए बहुत गर्मी लगती है! ☀️ तब खूब पानी पीना और धूप में टोपी पहनना।
e In summer, sunshine falls straight down on us, so it feels very hot! ☀️ Drink lots of water and wear a cap in the sun.
g Garmiyon mein dhoop hum par seedhi padti hai, isliye bahut garmi lagti hai! ☀️ Tab khoob paani peena aur dhoop mein topi pehenna.
@snow ? बर्फबारी,हिमपात,snow,snowing,snowfall,snowflake,barfbari,बर्फ गिर,barf gir
h बहुत ठंडी जगहों पर बादलों का पानी जमकर रुई जैसे फाहे बन जाता है — यही बर्फ़ गिरना है! ❄️ पहाड़ों पर सर्दियों में खूब बर्फ़ गिरती है।
e In very cold places, cloud water freezes into soft fluffy flakes — that's snow! ❄️ Mountains get lots of snow in winter.
g Bahut thandi jagahon par baadalon ka paani jamkar rui jaise phaahe ban jaata hai — yahi barf girna hai! ❄️ Pahaadon par sardiyon mein khoob barf girti hai.
@fog कोहरा,धुंध,fog,foggy,mist,misty,kohra,dhundh,dhund
h कोहरा ज़मीन के पास उतरा हुआ बादल होता है! 🌫️ ये अक्सर सर्दियों की सुबह आता है, तब सड़क पर बड़ों का हाथ पकड़कर धीरे चलना।
e Fog is a cloud that has come down close to the ground! 🌫️ It often comes on winter mornings, so hold a grown-up's hand and walk slowly.
g Kohra zameen ke paas utra hua baadal hota hai! 🌫️ Yeh aksar sardiyon ki subah aata hai, tab sadak par badon ka haath pakadkar dheere chalna.
@dew =ओस,dew,dewdrop,dewdrops,=os,=oas
h सुबह घास पर जो पानी की बूँदें दिखती हैं, उन्हें ओस कहते हैं! 💧 रात की ठंडी हवा अपना पानी बूँदें बनाकर पत्तों पर छोड़ देती है।
e The little water drops on the grass in the morning are called dew! 💧 Cool night air leaves its water on the leaves as drops.
g Subah ghaas par jo paani ki boondein dikhti hain, unhe os kehte hain! 💧 Raat ki thandi hawa apna paani boondein banakar patton par chhod deti hai.
@earth_round $EARTH,दुनिया,=world,duniya + गोल,round,ball,=gol,shape,आकार,flat,चपटी
h हमारी धरती एक बहुत बड़ी गेंद जैसी गोल है! 🌍 वो इतनी बड़ी है कि हमें चपटी लगती है।
e Our Earth is round, like a giant ball! 🌍 It is so big that it looks flat to us.
g Hamari dharti ek bahut badi gend jaisi gol hai! 🌍 Woh itni badi hai ki humein chapti lagti hai.
@earth_what ? $EARTH
h धरती हमारा घर है — एक बड़ा गोल ग्रह, जिस पर पानी, पेड़, जानवर और हम सब रहते हैं! 🌍 वो सूरज के चारों ओर घूमती है।
e Earth is our home — a big round planet with water, trees, animals and all of us! 🌍 It travels around the sun.
g Dharti hamara ghar hai — ek bada gol grah, jis par paani, ped, jaanwar aur hum sab rehte hain! 🌍 Woh suraj ke chaaron or ghoomti hai.
@gravity गिरती,गिरता,गिरते,गिर जात,fall,falls,falling,girti,girta,girte,gravity,गुरुत्वाकर्षण + $WHY,नीचे,neeche,niche,=down,gravity,गुरुत्वाकर्षण
h धरती हर चीज़ को अपनी तरफ़ खींचती है, इसे गुरुत्वाकर्षण कहते हैं! 🍎 इसलिए गेंद ऊपर फेंको तो वापस नीचे आती है, और हम ज़मीन पर टिके रहते हैं।
e The Earth pulls everything towards itself — that's called gravity! 🍎 That's why a ball comes back down, and why we stay on the ground.
g Dharti har cheez ko apni taraf kheenchti hai, ise gravity kehte hain! 🍎 Isliye gend upar phenko toh wapas neeche aati hai, aur hum zameen par tike rehte hain.
@sea_salty $SEA,समुद्री + नमक,खारा,खारे,नमकीन,salt,salty,namak,khara,khaara,namkeen
h नदियाँ चट्टानों से थोड़ा-थोड़ा नमक बहाकर समुद्र तक ले जाती हैं! 🌊 बहुत सालों से वो नमक जमा होता रहा, इसलिए समुद्र का पानी खारा है।
e Rivers carry tiny bits of salt from rocks down to the sea! 🌊 Over a very long time the salt built up, so sea water is salty.
g Nadiyaan chattanon se thoda-thoda namak bahaakar samudra tak le jaati hain! 🌊 Bahut saalon se woh namak jama hota raha, isliye samudra ka paani khaara hai.
@sea_what ? $SEA
h समुद्र खारे पानी का बहुत-बहुत बड़ा भंडार है! 🌊 उसमें मछलियाँ, कछुए, डॉल्फ़िन और व्हेल रहती हैं।
e The sea is a huge, huge stretch of salty water! 🌊 Fish, turtles, dolphins and whales live in it.
g Samudra khaare paani ka bahut-bahut bada bhandaar hai! 🌊 Usmein machhliyan, kachhue, dolphin aur whale rehti hain.
@waves ? लहर,लहरें,waves,lehar,leher,lehre
h समुद्र की लहरें ज़्यादातर हवा बनाती है! 🌊 हवा पानी को धकेलती है, तो पानी ऊपर-नीचे झूलता हुआ किनारे तक आता है।
e Most sea waves are made by the wind! 🌊 The wind pushes the water, and it rolls up and down all the way to the beach.
g Samudra ki lehrein zyadatar hawa banati hai! 🌊 Hawa paani ko dhakelti hai, toh paani upar-neeche jhoolta hua kinaare tak aata hai.
@river ? नदी,नदियां,नदियों,river,rivers,nadi,nadiyan,nadiyon
h नदी पहाड़ों पर पिघली बर्फ़ और बारिश के पानी से बनती है! 🏞️ वो बहती-बहती समुद्र तक जाती है।
e A river starts with rain and melting snow up in the hills! 🏞️ It flows and flows all the way to the sea.
g Nadi pahaadon par pighli barf aur baarish ke paani se banti hai! 🏞️ Woh behti-behti samudra tak jaati hai.
@mountain ? पहाड,पर्वत,mountain,mountains,=hill,hills,pahad,pahaad,parvat
h पहाड़ बहुत-बहुत पहले बने, जब धरती की बड़ी चट्टानें धीरे-धीरे ऊपर उठ गईं! ⛰️ ये इतना धीरे होता है कि लाखों साल लगते हैं।
e Mountains formed long, long ago when giant rocks in the Earth slowly pushed upwards! ⛰️ It happens so slowly that it takes millions of years.
g Pahaad bahut-bahut pehle bane, jab dharti ki badi chattanein dheere-dheere upar uth gayin! ⛰️ Yeh itna dheere hota hai ki laakhon saal lagte hain.
@shadow परछाई,परछाईं,छाया,shadow,shadows,parchhai,parchai,parchhayi,chhaya
h जब कोई चीज़ रोशनी को रोक लेती है, तो पीछे जो अँधेरी शक्ल बनती है, वो परछाईं है! 👤 धूप में हाथ हिलाओ, परछाईं भी हिलेगी।
e When something blocks the light, the dark shape behind it is a shadow! 👤 Wave your hand in the sunshine — your shadow waves too.
g Jab koi cheez roshni ko rok leti hai, toh peeche jo andheri shakal banti hai, woh parchhaai hai! 👤 Dhoop mein haath hilao, parchhaai bhi hilegi.
@echo गूंज,प्रतिध्वनि,echo,echoes,gunj,goonj
h गूँज तब सुनाई देती है जब हमारी आवाज़ दीवार या पहाड़ से टकराकर वापस आती है! 🗣️ बिल्कुल वैसे, जैसे गेंद दीवार से टकराकर लौटती है।
e An echo is your voice bouncing back off a wall or a mountain! 🗣️ Just like a ball bouncing back off a wall.
g Goonj tab sunaayi deti hai jab hamari awaaz deewar ya pahaad se takrakar wapas aati hai! 🗣️ Bilkul waise, jaise gend deewar se takrakar lautti hai.
@sand ? रेत,बालू,sand,=ret,balu,baalu
h रेत बहुत छोटे-छोटे पत्थरों के टुकड़ों से बनी है! 🏖️ पानी और हवा बरसों तक चट्टानों को घिस-घिसकर रेत बना देते हैं।
e Sand is made of tiny, tiny bits of rock! 🏖️ Water and wind rub big rocks for years and years until they become sand.
g Ret bahut chhote-chhote pattharon ke tukdon se bani hai! 🏖️ Paani aur hawa barson tak chattanon ko ghis-ghiskar ret bana dete hain.
@earthquake भूकंप,भूचाल,earthquake,earthquakes,bhukamp,bhookamp,bhuchal
h भूकंप में धरती के बहुत नीचे की चट्टानें खिसकती हैं, तो ज़मीन हिलती है! 🌍 ऐसा हो तो तुरंत बड़ों के पास जाना, वो जानते हैं क्या करना है।
e In an earthquake, giant rocks deep under the ground shift, so the ground shakes! 🌍 If it ever happens, go to a grown-up straight away — they know what to do.
g Bhookamp mein dharti ke bahut neeche ki chattanein khisakti hain, toh zameen hilti hai! 🌍 Aisa ho toh turant badon ke paas jaana, woh jaante hain kya karna hai.
@volcano ज्वालामुखी,volcano,volcanoes,jwalamukhi,jvalamukhi
h ज्वालामुखी एक पहाड़ है जिसके बहुत अंदर धरती की गर्म, पिघली चट्टान होती है! 🌋 कभी-कभी वो ऊपर से बाहर आती है। वैज्ञानिक ज्वालामुखियों पर ध्यान से नज़र रखते हैं।
e A volcano is a mountain with hot, melted rock deep inside! 🌋 Sometimes the melted rock comes out of the top. Scientists keep a careful eye on volcanoes.
g Jwalamukhi ek pahaad hai jiske bahut andar dharti ki garam, pighli chattaan hoti hai! 🌋 Kabhi-kabhi woh upar se bahar aati hai. Scientist jwalamukhiyon par dhyan se nazar rakhte hain.
@sky_end $SKY + खत्म,अंत,=end,ends,khatam,=ant,कहां तक,kahan tak,how high,ऊपर क्या,upar kya,above
h आसमान का कोई अंत नहीं है! 🌌 बहुत ऊपर हवा खत्म हो जाती है और फिर अंतरिक्ष शुरू होता है, जहाँ तारे और ग्रह हैं।
e The sky doesn't really end! 🌌 High up, the air runs out and space begins — that's where the stars and planets are.
g Aasmaan ka koi ant nahi hai! 🌌 Bahut upar hawa khatam ho jaati hai aur phir antariksh shuru hota hai, jahan taare aur grah hain.
@puddle ? कीचड,गड्ढे में पानी,puddle,puddles,mud,muddy,kichad
h बारिश का पानी ज़मीन के गड्ढों में रुक जाता है, तो पोखर बन जाता है! 💦 बड़ों से पूछकर गमबूट पहनो, फिर छप-छप करने में बड़ा मज़ा आता है।
e Rainwater collects in little dips in the ground and makes puddles! 💦 Ask a grown-up for boots, and splashing is so much fun.
g Baarish ka paani zameen ke gaddhon mein ruk jaata hai, toh pokhar ban jaata hai! 💦 Badon se poochhkar gumboot pehno, phir chhap-chhap karne mein bada mazaa aata hai.
`);

  defAnimals(`
~cow 🐄 गाय,गायें,=गौ,cow,cows,gaay,gaai,=gai,gaiya
h गाय घास, भूसा और हरा चारा खाती है। 🐄#गाय गाँव में, खेतों के पास और गौशाला में रहती है।#गाय के बच्चे को बछड़ा कहते हैं।#गाय हमें दूध देती है, जिससे दही और घी बनता है!#गाय रँभाती है — मूँ-मूँ! 🐄
e Cows eat grass, hay and green fodder. 🐄#Cows live on farms, in villages and in cow sheds.#A baby cow is called a calf.#Cows give us milk, and milk makes curd and ghee!#A cow says moo! 🐄
g Gaay ghaas, bhoosa aur hara chaara khaati hai. 🐄#Gaay gaon mein, kheton ke paas aur gaushala mein rehti hai.#Gaay ke bachche ko bachhda kehte hain.#Gaay humein doodh deti hai, jisse dahi aur ghee banta hai!#Gaay kehti hai — moo moo! 🐄
~dog 🐶 कुत्त,पिल्ला,पिल्ले,dog,dogs,doggy,puppy,puppies,kutta,kutte,kutton,pilla
h कुत्ते रोटी, दाल-चावल और कुत्तों वाला खास खाना खाते हैं। 🐶#पालतू कुत्ते हमारे घरों में रहते हैं, और कई कुत्ते गली-मोहल्ले में भी रहते हैं।#कुत्ते के बच्चे को पिल्ला कहते हैं।#कुत्ते बहुत वफ़ादार दोस्त होते हैं! 🐶 किसी कुत्ते को छूने से पहले बड़ों से पूछना।#कुत्ता भौंकता है — भौं-भौं! 🐶
e Dogs eat rice, roti, dal and special dog food. 🐶#Pet dogs live in our homes, and many dogs live on the streets too.#A baby dog is called a puppy.#Dogs are very loyal friends! 🐶 Always ask a grown-up before you touch a dog.#A dog says woof woof! 🐶
g Kutte roti, daal-chawal aur kutton wala khaas khaana khaate hain. 🐶#Paaltu kutte hamare gharon mein rehte hain, aur kai kutte gali-mohalle mein bhi rehte hain.#Kutte ke bachche ko pilla kehte hain.#Kutte bahut wafaadar dost hote hain! 🐶 Kisi kutte ko chhoone se pehle badon se poochhna.#Kutta bhaunkta hai — bhau bhau! 🐶
~cat 🐱 बिल्ल,बिलौटा,cat,cats,kitten,kittens,kitty,billi,billiyan
h बिल्ली मछली, मांस और बिल्लियों वाला खास खाना खाती है। 🐱#बिल्लियाँ घरों में, छतों पर और गलियों में रहती हैं।#बिल्ली के बच्चे को बिलौटा कहते हैं।#बिल्ली अपनी जीभ से चाटकर खुद को साफ़ करती है, और खुश होकर घुर्र-घुर्र करती है!#बिल्ली बोलती है — म्याऊँ-म्याऊँ! 🐱
e Cats eat fish, meat and special cat food. 🐱#Cats live in homes, on rooftops and in the lanes.#A baby cat is called a kitten.#Cats clean themselves by licking their fur, and they purr when they're happy!#A cat says meow! 🐱
g Billi machhli, maas aur billiyon wala khaas khaana khaati hai. 🐱#Billiyaan gharon mein, chhaton par aur galiyon mein rehti hain.#Billi ke bachche ko bilauta kehte hain.#Billi apni jeebh se chaatkar khud ko saaf karti hai, aur khush hokar ghurr-ghurr karti hai!#Billi bolti hai — myaoon myaoon! 🐱
~lion 🦁 शेर,शेरनी,=सिंह,lion,lions,lioness,=sher,sherni,=singh
h शेर मांस खाता है। 🦁#शेर घास वाले बड़े मैदानों और जंगलों में अपने परिवार के साथ रहते हैं।#शेर के बच्चे को शावक कहते हैं।#शेर को जंगल का राजा कहते हैं, और भारत में शेर गुजरात के गिर जंगल में रहते हैं!#शेर दहाड़ता है — रॉआआर! 🦁
e Lions eat meat. 🦁#Lions live in grasslands and forests with their family, called a pride.#A baby lion is called a cub.#The lion is called the king of the jungle, and in India lions live in the Gir forest!#A lion says ROAR! 🦁
g Sher maas khaata hai. 🦁#Sher ghaas wale bade maidaanon aur jangalon mein apne parivaar ke saath rehte hain.#Sher ke bachche ko shaavak kehte hain.#Sher ko jungle ka raja kehte hain, aur Bharat mein sher Gujarat ke Gir jungle mein rehte hain!#Sher dahaadta hai — roaaar! 🦁
~tiger 🐯 बाघ,टाइगर,tiger,tigers,tigress,=bagh,baagh
h बाघ मांस खाता है। 🐯#बाघ घने जंगलों में अकेले रहना पसंद करता है।#बाघ के बच्चे को शावक कहते हैं।#बाघ हमारा राष्ट्रीय पशु है, और हर बाघ की धारियाँ अलग होती हैं!#बाघ गुर्राता और दहाड़ता है — ग्र्र्र! 🐯
e Tigers eat meat. 🐯#Tigers live in thick forests and like to be on their own.#A baby tiger is called a cub.#The tiger is India's national animal, and every tiger has its own special stripes!#A tiger growls and roars — grrr! 🐯
g Baagh maas khaata hai. 🐯#Baagh ghane jangalon mein akele rehna pasand karta hai.#Baagh ke bachche ko shaavak kehte hain.#Baagh hamara rashtriya pashu hai, aur har baagh ki dhaariyan alag hoti hain!#Baagh gurraata aur dahaadta hai — grrr! 🐯
~elephant 🐘 हाथी,elephant,elephants,hathi,haathi,gajraj
h हाथी घास, पत्ते, केले और गन्ना खाता है — दिन भर खाता ही रहता है! 🐘#हाथी जंगलों में अपने बड़े परिवार के साथ रहते हैं।#हाथी का बच्चा माँ के पास-पास रहता है और कभी-कभी सूँड से उसकी पूँछ पकड़ लेता है!#हाथी ज़मीन का सबसे बड़ा जानवर है, और वो सूँड से पानी पीता और नहाता है!#हाथी चिंघाड़ता है — पों-पों! 🐘
e Elephants eat grass, leaves, bananas and sugarcane — they eat almost all day! 🐘#Elephants live in forests with their big families.#A baby elephant is called a calf, and it sometimes holds its mummy's tail with its trunk!#The elephant is the biggest animal on land, and it uses its trunk to drink and take a shower!#An elephant trumpets — pawoo! 🐘
g Haathi ghaas, patte, kele aur ganna khaata hai — din bhar khaata hi rehta hai! 🐘#Haathi jangalon mein apne bade parivaar ke saath rehte hain.#Haathi ka bachcha maa ke paas-paas rehta hai aur kabhi-kabhi soond se uski poonch pakad leta hai!#Haathi zameen ka sabse bada jaanwar hai, aur woh soond se paani peeta aur nahaata hai!#Haathi chinghaadta hai — pon pon! 🐘
~monkey 🐒 बंदर,वानर,लंगूर,monkey,monkeys,bandar,langur
h बंदर केले, फल, पत्ते और बीज खाते हैं। 🐒#बंदर पेड़ों पर रहते हैं, और कई बंदर शहरों में भी घूमते हैं।#बंदर का बच्चा अपनी माँ के पेट से चिपककर घूमता है!#बंदर एक डाल से दूसरी डाल पर कूदने में उस्ताद होते हैं!#बंदर बोलता है — ऊँ-ऊँ, आ-आ! 🐒
e Monkeys eat bananas, fruits, leaves and seeds. 🐒#Monkeys live in trees, and many monkeys roam around in cities too.#A baby monkey holds on tight to its mummy's tummy as she moves!#Monkeys are champions at jumping from branch to branch!#A monkey says ooh ooh, aah aah! 🐒
g Bandar kele, phal, patte aur beej khaate hain. 🐒#Bandar pedon par rehte hain, aur kai bandar shehron mein bhi ghoomte hain.#Bandar ka bachcha apni maa ke pet se chipak kar ghoomta hai!#Bandar ek daal se doosri daal par koodne mein ustaad hote hain!#Bandar bolta hai — oon oon, aa aa! 🐒
~horse 🐴 घोड,horse,horses,pony,ghoda,ghode,ghodi
h घोड़ा घास, चना और भूसा खाता है। 🐴#घोड़े अस्तबल में, खेतों में और खुले मैदानों में रहते हैं।#घोड़े के बच्चे को बछेड़ा कहते हैं।#घोड़े खड़े-खड़े भी सो सकते हैं, और बहुत तेज़ दौड़ते हैं!#घोड़ा हिनहिनाता है — हिन-हिन! 🐴
e Horses eat grass, hay and grains. 🐴#Horses live in stables, on farms and in open fields.#A baby horse is called a foal.#Horses can sleep standing up, and they run super fast!#A horse neighs — neigh! 🐴
g Ghoda ghaas, chana aur bhoosa khaata hai. 🐴#Ghode astabal mein, kheton mein aur khule maidaanon mein rehte hain.#Ghode ke bachche ko bachheda kehte hain.#Ghode khade-khade bhi so sakte hain, aur bahut tez daudte hain!#Ghoda hinhinaata hai — hin hin! 🐴
~goat 🐐 बकरी,बकरा,बकरे,बकरियां,goat,goats,bakri,bakra,bakre,bakriyan
h बकरी घास, पत्ते और झाड़ियाँ खाती है। 🐐#बकरियाँ गाँव में, खेतों में और पहाड़ों पर रहती हैं।#बकरी के बच्चे को मेमना कहते हैं।#बकरियाँ पहाड़ों पर बड़ी आसानी से चढ़ जाती हैं!#बकरी बोलती है — मैं-मैं! 🐐
e Goats eat grass, leaves and bushes. 🐐#Goats live in villages, on farms and up in the hills.#A baby goat is called a kid.#Goats are great climbers — they can climb up steep hills!#A goat says maa maa! 🐐
g Bakri ghaas, patte aur jhaadiyan khaati hai. 🐐#Bakriyan gaon mein, kheton mein aur pahaadon par rehti hain.#Bakri ke bachche ko memna kehte hain.#Bakriyan pahaadon par badi aasaani se chadh jaati hain!#Bakri bolti hai — main main! 🐐
~sheep 🐑 भेड,sheep,lamb,lambs,bhed,bhedh,bheden
h भेड़ घास खाती है। 🐑#भेड़ें झुंड में खेतों और पहाड़ी मैदानों में रहती हैं।#भेड़ के बच्चे को मेमना कहते हैं।#भेड़ के बालों से ऊन बनती है, जिससे गरम स्वेटर बनते हैं!#भेड़ बोलती है — में-में! 🐑
e Sheep eat grass. 🐑#Sheep live together in flocks on farms and hillsides.#A baby sheep is called a lamb.#A sheep's woolly coat gives us wool for warm sweaters!#A sheep says baa baa! 🐑
g Bhed ghaas khaati hai. 🐑#Bheden jhund mein kheton aur pahaadi maidaanon mein rehti hain.#Bhed ke bachche ko memna kehte hain.#Bhed ke baalon se oon banti hai, jisse garam sweater bante hain!#Bhed bolti hai — mein mein! 🐑
~buffalo 🐃 भैंस,buffalo,buffaloes,buffalos,bhains,bhens,bhais
h भैंस घास, भूसा और हरा चारा खाती है। 🐃#भैंस गाँव में रहती है, और उसे पानी में बैठना बहुत पसंद है।#भैंस के बच्चे को पड़वा या कटड़ा कहते हैं।#भैंस हमें गाढ़ा दूध देती है, और गर्मी में पानी में डुबकी लगाती है!#भैंस भी रँभाती है, पर गाय से भारी आवाज़ में! 🐃
e Buffaloes eat grass, hay and green fodder. 🐃#Buffaloes live in villages, and they love sitting in water.#A baby buffalo is called a calf.#Buffaloes give us thick milk, and they love a dip on hot days!#A buffalo moos too — in a deep, low voice! 🐃
g Bhains ghaas, bhoosa aur hara chaara khaati hai. 🐃#Bhains gaon mein rehti hai, aur use paani mein baithna bahut pasand hai.#Bhains ke bachche ko padwa ya katda kehte hain.#Bhains humein gaadha doodh deti hai, aur garmi mein paani mein dubki lagaati hai!#Bhains bhi moo karti hai, par gaay se bhaari awaaz mein! 🐃
~camel 🐪 ऊंट,camel,camels,=unt,=oont,=unth
h ऊँट काँटेदार झाड़ियाँ, पत्ते और घास खाता है। 🐪#ऊँट रेगिस्तान में रहता है, जैसे राजस्थान में।#ऊँट का बच्चा पैदा होने के कुछ ही घंटों में चलने लगता है!#ऊँट कई दिनों तक बिना पानी के रह सकता है, इसलिए उसे रेगिस्तान का जहाज़ कहते हैं!#ऊँट बलबलाता है — ब्लब-ब्लब! 🐪
e Camels eat thorny bushes, leaves and grass. 🐪#Camels live in deserts, like the Thar desert in Rajasthan.#A baby camel is called a calf, and it can walk just a few hours after it's born!#Camels can go many days without water — they're called ships of the desert!#A camel grumbles and gurgles — blub blub! 🐪
g Oont kaantedaar jhaadiyan, patte aur ghaas khaata hai. 🐪#Oont registaan mein rehta hai, jaise Rajasthan mein.#Oont ka bachcha paida hone ke kuch hi ghanton mein chalne lagta hai!#Oont kai dinon tak bina paani ke reh sakta hai, isliye use registaan ka jahaaz kehte hain!#Oont balbalaata hai — blub blub! 🐪
~giraffe 🦒 जिराफ,giraffe,giraffes,jiraf,jiraaf
h जिराफ़ ऊँचे पेड़ों की पत्तियाँ खाता है। 🦒#जिराफ़ अफ़्रीका के घास वाले मैदानों में रहता है।#जिराफ़ का बच्चा पैदा होते ही एक बड़े आदमी जितना लंबा होता है!#जिराफ़ दुनिया का सबसे लंबा जानवर है, उसकी गर्दन बहुत लंबी होती है!#जिराफ़ बहुत कम बोलता है, बस धीरे से गुनगुनाता है — हम्म! 🦒
e Giraffes eat leaves from tall trees. 🦒#Giraffes live on the grassy plains of Africa.#A baby giraffe is as tall as a grown-up person when it's born!#The giraffe is the tallest animal in the world, with a super long neck!#Giraffes are very quiet — they softly hum, hmmm! 🦒
g Giraffe oonche pedon ki pattiyan khaata hai. 🦒#Giraffe Africa ke ghaas wale maidaanon mein rehta hai.#Giraffe ka bachcha paida hote hi ek bade aadmi jitna lamba hota hai!#Giraffe duniya ka sabse lamba jaanwar hai, uski gardan bahut lambi hoti hai!#Giraffe bahut kam bolta hai, bas dheere se gungunata hai — hmmm! 🦒
~zebra 🦓 जेबरा,zebra,zebras,jebra
h ज़ेबरा घास खाता है। 🦓#ज़ेबरा अफ़्रीका के घास वाले मैदानों में झुंड में रहते हैं।#ज़ेबरा का बच्चा अपनी माँ की धारियाँ पहचानकर उसे ढूँढ लेता है!#हर ज़ेबरा की काली-सफ़ेद धारियाँ अलग होती हैं, बिल्कुल हमारी उँगलियों के निशान की तरह!#ज़ेबरा हिनहिनाता है और भौंकने जैसी आवाज़ भी करता है! 🦓
e Zebras eat grass. 🦓#Zebras live in herds on the grassy plains of Africa.#A baby zebra learns its mummy's stripes so it can always find her!#Every zebra has its own stripe pattern, just like our fingerprints!#Zebras whinny and even make a barking sound! 🦓
g Zebra ghaas khaata hai. 🦓#Zebra Africa ke ghaas wale maidaanon mein jhund mein rehte hain.#Zebra ka bachcha apni maa ki dhaariyan pehchaankar use dhoondh leta hai!#Har zebra ki kaali-safed dhaariyan alag hoti hain, bilkul hamari ungliyon ke nishaan ki tarah!#Zebra hinhinaata hai aur bhaunkne jaisi awaaz bhi karta hai! 🦓
~bear 🐻 भालू,bear,bears,bhalu,bhaalu,teddy
h भालू शहद, फल, जड़ें और दीमक खाता है। 🐻#भालू जंगलों और गुफाओं में रहते हैं।#भालू के बच्चे को शावक कहते हैं।#भालू को मीठा शहद बहुत पसंद है, और ठंडी जगहों के भालू सर्दियों में लंबी नींद सोते हैं!#भालू गुर्राता है — ग्र्र-ग्र्र! 🐻
e Bears eat honey, fruits, roots and even termites. 🐻#Bears live in forests and caves.#A baby bear is called a cub.#Bears love sweet honey, and bears in cold places sleep through the winter!#A bear growls — grr grr! 🐻
g Bhaalu shahad, phal, jadein aur deemak khaata hai. 🐻#Bhaalu jangalon aur gufaon mein rehte hain.#Bhaalu ke bachche ko shaavak kehte hain.#Bhaalu ko meetha shahad bahut pasand hai, aur thandi jagahon ke bhaalu sardiyon mein lambi neend sote hain!#Bhaalu gurraata hai — grr grr! 🐻
~rabbit 🐰 खरगोश,rabbit,rabbits,bunny,bunnies,khargosh,khargos
h खरगोश घास, हरी पत्तियाँ और थोड़ी गाजर खाता है। 🐰#खरगोश ज़मीन के अंदर बिल में रहते हैं।#खरगोश के बच्चे बहुत छोटे और रुई जैसे नरम होते हैं!#खरगोश के लंबे कान बहुत दूर की आवाज़ भी सुन लेते हैं!#खरगोश ज़्यादा नहीं बोलता, बस अपनी नाक हिलाता है! 🐰
e Rabbits eat grass, hay, leafy greens and a little carrot. 🐰#Rabbits live in burrows under the ground.#A baby rabbit is called a kit, and it's as soft as cotton!#A rabbit's long ears can hear sounds from far away!#Rabbits are very quiet — they just wiggle their noses! 🐰
g Khargosh ghaas, hari pattiyan aur thodi gaajar khaata hai. 🐰#Khargosh zameen ke andar bil mein rehte hain.#Khargosh ke bachche bahut chhote aur rui jaise naram hote hain!#Khargosh ke lambe kaan bahut door ki awaaz bhi sun lete hain!#Khargosh zyada nahi bolta, bas apni naak hilaata hai! 🐰
~deer 🦌 हिरण,हिरन,deer,hiran,=harin
h हिरण घास, पत्तियाँ और फल खाता है। 🦌#हिरण जंगलों और घास के मैदानों में रहते हैं।#हिरण के बच्चे को छौना कहते हैं।#हिरण बहुत तेज़ दौड़ता है और ऊँची छलाँग लगाता है!#हिरण धीरे से मिमियाता है, जैसे छोटी-सी सीटी! 🦌
e Deer eat grass, leaves and fruits. 🦌#Deer live in forests and grasslands.#A baby deer is called a fawn.#Deer run very fast and make big leaps!#Deer make soft bleating sounds, like a tiny whistle! 🦌
g Hiran ghaas, pattiyan aur phal khaata hai. 🦌#Hiran jangalon aur ghaas ke maidaanon mein rehte hain.#Hiran ke bachche ko chhauna kehte hain.#Hiran bahut tez daudta hai aur oonchi chhalaang lagaata hai!#Hiran dheere se mimiyata hai, jaise chhoti si seeti! 🦌
~squirrel 🐿️ गिलहरी,squirrel,squirrels,gilhari,gilehri
h गिलहरी मेवे, बीज, फल और दाने खाती है। 🐿️#गिलहरी पेड़ों पर अपना घोंसला बनाकर रहती है।#गिलहरी के बच्चे बहुत छोटे होते हैं, और माँ उन्हें घोंसले में संभालकर रखती है।#गिलहरी अपनी झबरी पूँछ से पेड़ों पर संतुलन बनाती है!#गिलहरी चिक-चिक, चूँ-चूँ करती है! 🐿️
e Squirrels eat nuts, seeds, fruits and grains. 🐿️#Squirrels live in nests up in the trees.#A baby squirrel is called a kit, and its mummy keeps it safe in the nest.#A squirrel uses its bushy tail to balance in the trees!#A squirrel chatters — chik chik! 🐿️
g Gilhari meve, beej, phal aur daane khaati hai. 🐿️#Gilhari pedon par apna ghonsla banakar rehti hai.#Gilhari ke bachche bahut chhote hote hain, aur maa unhe ghonsle mein sambhaal kar rakhti hai.#Gilhari apni jhabri poonch se pedon par santulan banaati hai!#Gilhari chik-chik, choon-choon karti hai! 🐿️
~mouse 🐭 चूहा,चूहे,चुहिया,mouse,mice,chuha,chuhe,chuhiya
h चूहे दाने, अनाज, बीज और जो खाना मिल जाए, सब खा लेते हैं। 🐭#चूहे छोटे-छोटे बिलों में और कोनों में छिपकर रहते हैं।#चूहे के बच्चे बहुत छोटे और गुलाबी होते हैं।#चूहे के दाँत हमेशा बढ़ते रहते हैं, इसलिए वो चीज़ें कुतरते रहते हैं!#चूहा बोलता है — चूँ-चूँ! 🐭
e Mice eat grains, seeds and almost any food they find. 🐭#Mice live in tiny holes and cosy corners.#A baby mouse is called a pinkie — it's tiny and pink!#A mouse's teeth never stop growing, so mice nibble all the time!#A mouse says squeak squeak! 🐭
g Chuhe daane, anaaj, beej aur jo khaana mil jaaye, sab kha lete hain. 🐭#Chuhe chhote-chhote bilon mein aur konon mein chhipkar rehte hain.#Chuhe ke bachche bahut chhote aur gulaabi hote hain.#Chuhe ke daant hamesha badhte rehte hain, isliye woh cheezein kutarte rehte hain!#Chuha bolta hai — choon choon! 🐭
~frog 🐸 मेंढक,मेढक,frog,frogs,toad,mendhak,mendak,medhak
h मेंढक अपनी लंबी चिपचिपी जीभ से कीड़े और मक्खियाँ पकड़कर खाता है! 🐸#मेंढक तालाब के पास, पानी और ज़मीन दोनों जगह रहता है।#मेंढक के बच्चे को टैडपोल कहते हैं — वो मछली जैसा तैरता है, फिर उसके पैर निकलते हैं!#मेंढक बहुत ऊँची छलाँग लगाता है और बारिश में खूब टर्राता है!#मेंढक टर्राता है — टर्र-टर्र! 🐸
e Frogs catch bugs and flies with their long sticky tongues! 🐸#Frogs live near ponds — both in water and on land.#A baby frog is called a tadpole — it swims like a fish, then grows legs!#Frogs can jump really far, and they sing a lot in the rain!#A frog says ribbit ribbit! 🐸
g Mendhak apni lambi chipchipi jeebh se keede aur makkhiyan pakadkar khaata hai! 🐸#Mendhak taalaab ke paas, paani aur zameen dono jagah rehta hai.#Mendhak ke bachche ko tadpole kehte hain — woh machhli jaisa tairta hai, phir uske pair nikalte hain!#Mendhak bahut oonchi chhalaang lagaata hai aur baarish mein khoob tarraata hai!#Mendhak tarraata hai — tarr tarr! 🐸
~fish 🐟 मछली,मछलियां,मछलियों,fish,fishes,machli,machhli,machhliyan,machliyan
h मछलियाँ पानी के छोटे पौधे, कीड़े और नन्ही-नन्ही चीज़ें खाती हैं। 🐟#मछलियाँ पानी में रहती हैं — नदी, तालाब और समुद्र में।#मछली के छोटे-छोटे बच्चे अंडों से निकलते हैं!#मछलियाँ अपने गलफड़ों से पानी में साँस लेती हैं!#मछलियाँ बोलती नहीं, पर पानी में बुलबुले बनाती हैं — बुल-बुल! 🐟
e Fish eat tiny water plants, bugs and other little things. 🐟#Fish live in water — in rivers, ponds and the sea.#Baby fish are called fry, and they hatch from eggs!#Fish breathe in water using their gills!#Fish don't talk, but they make bubbles — blub blub! 🐟
g Machhliyan paani ke chhote paudhe, keede aur nanhi-nanhi cheezein khaati hain. 🐟#Machhliyan paani mein rehti hain — nadi, taalaab aur samudra mein.#Machhli ke chhote-chhote bachche andon se nikalte hain!#Machhliyan apne galphadon se paani mein saans leti hain!#Machhliyan bolti nahi, par paani mein bulbule banaati hain — bul bul! 🐟
`);

  defAnimals(`
~turtle 🐢 कछुआ,कछुए,turtle,turtles,tortoise,tortoises,kachhua,kachua,kachhue
h कछुए पत्ते, घास और फल खाते हैं, और पानी वाले कछुए छोटे कीड़े भी। 🐢#कुछ कछुए ज़मीन पर रहते हैं, और कुछ पानी में।#कछुए के बच्चे अंडों से निकलते हैं और खुद अपना रास्ता ढूँढते हैं!#कछुआ अपना घर — अपना कवच — पीठ पर लेकर चलता है!#कछुआ लगभग चुप रहता है, बस धीरे से फुफकारता है! 🐢
e Tortoises eat leaves, grass and fruits, and water turtles eat little bugs too. 🐢#Some turtles live on land, and some live in water.#Baby turtles hatch from eggs and find their own way!#A turtle carries its house — its shell — on its back!#Turtles are almost silent — they just hiss softly! 🐢
g Kachhue patte, ghaas aur phal khaate hain, aur paani wale kachhue chhote keede bhi. 🐢#Kuch kachhue zameen par rehte hain, aur kuch paani mein.#Kachhue ke bachche andon se nikalte hain aur khud apna raasta dhoondhte hain!#Kachhua apna ghar — apna kavach — peeth par lekar chalta hai!#Kachhua lagbhag chup rehta hai, bas dheere se phuphkaarta hai! 🐢
~snake 🐍 सांप,नाग,snake,snakes,saanp,=sanp,=saap,=sap
h साँप चूहे, मेंढक और कीड़े खाते हैं — वो खाना पूरा निगल जाते हैं! 🐍#साँप बिलों में, घास में और पत्थरों के नीचे रहते हैं।#साँप के बच्चे ज़्यादातर अंडों से निकलते हैं।#साँप के पैर नहीं होते, वो पेट के बल सरकते हैं! 🐍 साँप दिखे तो दूर रहो और बड़ों को बताओ।#साँप फुफकारता है — स्स्स्स! 🐍
e Snakes eat mice, frogs and insects — they swallow their food whole! 🐍#Snakes live in holes, in tall grass and under rocks.#Most baby snakes hatch from eggs.#Snakes have no legs — they slide along on their tummies! 🐍 If you see a snake, stay away and tell a grown-up.#A snake hisses — sssss! 🐍
g Saanp chuhe, mendhak aur keede khaate hain — woh khaana poora nigal jaate hain! 🐍#Saanp bilon mein, ghaas mein aur pattharon ke neeche rehte hain.#Saanp ke bachche zyadatar andon se nikalte hain.#Saanp ke pair nahi hote, woh pet ke bal sarakte hain! 🐍 Saanp dikhe toh door raho aur badon ko batao.#Saanp phuphkaarta hai — ssss! 🐍
~crocodile 🐊 मगरमच्छ,घडियाल,crocodile,crocodiles,=croc,alligator,=magar,magarmach,magarmachh,ghadiyal
h मगरमच्छ मछलियाँ और दूसरे जानवर खाता है। 🐊#मगरमच्छ नदियों और झीलों में रहता है, और किनारे पर धूप सेंकता है।#मगरमच्छ के बच्चे अंडों से निकलते हैं, और माँ उन्हें मुँह में बड़े प्यार से उठाकर पानी तक ले जाती है!#मगरमच्छ डायनासोर के ज़माने से धरती पर हैं!#मगरमच्छ गुर्राता है, और उसके बच्चे चीं-चीं करते हैं! 🐊
e Crocodiles eat fish and other animals. 🐊#Crocodiles live in rivers and lakes, and sunbathe on the banks.#Baby crocodiles hatch from eggs, and their mummy gently carries them to the water in her mouth!#Crocodiles have been on Earth since the time of the dinosaurs!#Crocodiles growl, and their babies chirp! 🐊
g Magarmachh machhliyan aur doosre jaanwar khaata hai. 🐊#Magarmachh nadiyon aur jheelon mein rehta hai, aur kinaare par dhoop senkta hai.#Magarmachh ke bachche andon se nikalte hain, aur maa unhe munh mein pyaar se uthakar paani tak le jaati hai!#Magarmachh dinosaur ke zamaane se dharti par hain!#Magarmachh gurraata hai, aur uske bachche cheen-cheen karte hain! 🐊
~dolphin 🐬 डॉल्फिन,डाल्फिन,dolphin,dolphins,=susu
h डॉल्फ़िन मछलियाँ खाती है। 🐬#डॉल्फ़िन समुद्र में रहती है, और भारत की गंगा नदी में भी डॉल्फ़िन रहती है!#डॉल्फ़िन का बच्चा माँ के साथ-साथ तैरता है और माँ का दूध पीता है।#डॉल्फ़िन बहुत समझदार होती है और पानी से उछल-उछलकर खेलती है!#डॉल्फ़िन सीटी और क्लिक जैसी आवाज़ें निकालती है! 🐬
e Dolphins eat fish. 🐬#Dolphins live in the sea, and India's Ganga river has dolphins too!#A baby dolphin is called a calf — it swims right beside its mummy and drinks her milk.#Dolphins are very clever and love to leap out of the water and play!#Dolphins whistle and click! 🐬
g Dolphin machhliyan khaati hai. 🐬#Dolphin samudra mein rehti hai, aur Bharat ki Ganga nadi mein bhi dolphin rehti hai!#Dolphin ka bachcha maa ke saath-saath tairta hai aur maa ka doodh peeta hai.#Dolphin bahut samajhdaar hoti hai aur paani se uchhal-uchhalkar khelti hai!#Dolphin seeti aur click jaisi awaazein nikaalti hai! 🐬
~whale 🐋 व्हेल,whale,whales
h व्हेल छोटे-छोटे झींगे और मछलियाँ खाती है — एक बार में बहुत सारी! 🐋#व्हेल गहरे समुद्र में रहती है।#व्हेल का बच्चा पैदा होते ही तैरने लगता है और माँ का दूध पीता है।#नीली व्हेल दुनिया का सबसे बड़ा जानवर है — हाथी से भी कई गुना बड़ी!#व्हेल गाने जैसी लंबी आवाज़ें निकालती है — ऊऊऊ! 🐋
e Whales eat tiny shrimp and fish — lots at a time! 🐋#Whales live in the deep sea.#A baby whale is called a calf — it can swim as soon as it's born and drinks its mummy's milk.#The blue whale is the biggest animal ever — much bigger than an elephant!#Whales sing long songs — oooooo! 🐋
g Whale chhote-chhote jheenge aur machhliyan khaati hai — ek baar mein bahut saari! 🐋#Whale gehre samudra mein rehti hai.#Whale ka bachcha paida hote hi tairne lagta hai aur maa ka doodh peeta hai.#Neeli whale duniya ka sabse bada jaanwar hai — haathi se bhi kai guna badi!#Whale gaane jaisi lambi awaazein nikaalti hai — ooooo! 🐋
~penguin 🐧 पेंगुइन,पेंग्विन,penguin,penguins,pengvin
h पेंगुइन मछलियाँ और छोटे झींगे खाता है। 🐧#पेंगुइन धरती के सबसे ठंडे हिस्से में, बर्फ़ के पास रहते हैं।#पेंगुइन के बच्चे को चूज़ा कहते हैं, और कुछ पेंगुइन पापा अंडे को अपने पैरों पर रखकर गर्म रखते हैं!#पेंगुइन पक्षी है पर उड़ता नहीं, वो पानी में बहुत तेज़ तैरता है!#पेंगुइन तुरही जैसी आवाज़ में बोलता है — आ-आ-आ! 🐧
e Penguins eat fish and tiny shrimp. 🐧#Penguins live in the coldest places on Earth, near ice and snow.#A baby penguin is called a chick, and some penguin dads keep the egg warm on their feet!#Penguins are birds that can't fly, but they swim super fast!#Penguins honk and squawk! 🐧
g Penguin machhliyan aur chhote jheenge khaata hai. 🐧#Penguin dharti ke sabse thande hisse mein, barf ke paas rehte hain.#Penguin ke bachche ko chooza kehte hain, aur kuch penguin papa ande ko apne pairon par rakhkar garam rakhte hain!#Penguin pakshi hai par udta nahi, woh paani mein bahut tez tairta hai!#Penguin turhi jaisi awaaz mein bolta hai — aa aa aa! 🐧
~owl 🦉 उल्लू,owl,owls,owlet,=ullu,=ulu
h उल्लू चूहे और कीड़े खाता है। 🦉#उल्लू पेड़ों के खोखले हिस्सों में और पुरानी इमारतों में रहता है।#उल्लू के बच्चे रुई के गोले जैसे फूले-फूले होते हैं!#उल्लू रात को जागता है, और अपना सिर लगभग पूरा पीछे घुमा सकता है!#उल्लू बोलता है — हू-हू! 🦉
e Owls eat mice and insects. 🦉#Owls live in hollow trees and old buildings.#A baby owl is called an owlet — it looks like a fluffy cotton ball!#Owls stay awake at night, and can turn their heads almost all the way around!#An owl says hoo hoo! 🦉
g Ullu chuhe aur keede khaata hai. 🦉#Ullu pedon ke khokhle hisson mein aur puraani imaaraton mein rehta hai.#Ullu ke bachche rui ke gole jaise phoole-phoole hote hain!#Ullu raat ko jaagta hai, aur apna sir lagbhag poora peeche ghuma sakta hai!#Ullu bolta hai — hoo hoo! 🦉
~parrot 🦜 तोता,तोते,parrot,parrots,=tota,=tote,tote,totaa
h तोता फल, मिर्च, अमरूद और बीज खाता है — मुझे भी अमरूद बहुत पसंद है! 🦜#तोते पेड़ों के खोखलों में घोंसला बनाकर रहते हैं।#तोते के बच्चे अंडों से निकलते हैं, और शुरू में उनके पंख नहीं होते।#तोते सुनी हुई बातों की नकल कर सकते हैं — बिल्कुल मेरी तरह!#तोता बोलता है — टें-टें, मिट्ठू-मिट्ठू! 🦜
e Parrots eat fruits, chillies, guavas and seeds — I love guavas too! 🦜#Parrots live in holes in trees.#Baby parrots hatch from eggs and have no feathers at first.#Parrots can copy words they hear — just like me!#A parrot says squawk — Mitthu Mitthu! 🦜
g Tota phal, mirch, amrood aur beej khaata hai — mujhe bhi amrood bahut pasand hai! 🦜#Tote pedon ke khokhlon mein ghonsla banakar rehte hain.#Tote ke bachche andon se nikalte hain, aur shuru mein unke pankh nahi hote.#Tote suni hui baaton ki nakal kar sakte hain — bilkul meri tarah!#Tota bolta hai — tein tein, Mitthu Mitthu! 🦜
~crow 🐦 कौआ,कौवा,कौए,कौवे,crow,crows,kauwa,kauva,=kaua,kauve,kauwe
h कौआ लगभग सब कुछ खा लेता है — दाने, फल, रोटी और कीड़े। 🐦#कौए पेड़ों पर टहनियों का घोंसला बनाकर रहते हैं।#कौए के बच्चे घोंसले में रहते हैं, और माँ-पापा दोनों उन्हें खाना खिलाते हैं।#कौआ बहुत होशियार पक्षी है — याद है, प्यासे कौए ने कंकड़ डालकर पानी पिया था!#कौआ बोलता है — काँव-काँव! 🐦
e Crows eat almost anything — grains, fruits, bread and bugs. 🐦#Crows live in nests made of twigs up in the trees.#Baby crows stay in the nest, and both mummy and papa crow feed them.#Crows are very clever birds — remember the thirsty crow who dropped pebbles to get water!#A crow says caw caw! 🐦
g Kauwa lagbhag sab kuch kha leta hai — daane, phal, roti aur keede. 🐦#Kauwe pedon par tehniyon ka ghonsla banakar rehte hain.#Kauwe ke bachche ghonsle mein rehte hain, aur maa-papa dono unhe khaana khilaate hain.#Kauwa bahut hoshiyaar pakshi hai — yaad hai, pyaase kauwe ne kankad daalkar paani piya tha!#Kauwa bolta hai — kaanv kaanv! 🐦
~peacock 🦚 मोर,मोरनी,peacock,peacocks,peahen,=mor,morni
h मोर दाने, कीड़े, फल और छोटे जीव खाता है। 🦚#मोर जंगलों में, खेतों के पास और गाँवों में रहते हैं।#मोर के बच्चे को चूज़ा कहते हैं, और उसकी माँ को मोरनी।#मोर हमारा राष्ट्रीय पक्षी है, और बारिश आने पर रंग-बिरंगे पंख फैलाकर नाचता है!#मोर ज़ोर से पुकारता है — मे-आँव, मे-आँव! 🦚
e Peacocks eat grains, insects, fruits and little creatures. 🦚#Peacocks live in forests, near fields and in villages.#A baby peacock is called a peachick, and its mummy is a peahen.#The peacock is India's national bird, and it dances with its colourful feathers when rain is coming!#A peacock calls loudly — may-awe, may-awe! 🦚
g Mor daane, keede, phal aur chhote jeev khaata hai. 🦚#Mor jangalon mein, kheton ke paas aur gaon mein rehte hain.#Mor ke bachche ko chooza kehte hain, aur uski maa ko morni.#Mor hamara rashtriya pakshi hai, aur baarish aane par rang-birange pankh phailakar naachta hai!#Mor zor se pukaarta hai — me-aaon, me-aaon! 🦚
~hen 🐔 मुर्गी,मुर्गा,मुर्गे,मुर्गियां,चूजा,चूजे,hen,hens,chicken,chickens,rooster,chick,chicks,murgi,murga,murge,chooza,chuja,chuje
h मुर्गी दाने, बीज और कीड़े खाती है। 🐔#मुर्गियाँ खेतों में और दड़बे में रहती हैं।#मुर्गी के बच्चे को चूज़ा कहते हैं — पीला और रुई जैसा नरम!#मुर्गी अंडे देती है, और उन्हें गर्म रखकर उनमें से चूज़े निकालती है!#मुर्गा बोलता है कुकड़ूँ-कूँ, और मुर्गी बोलती है कुट-कुट! 🐔
e Hens eat grains, seeds and bugs. 🐔#Hens live on farms and in hen houses.#A baby hen is called a chick — yellow and fluffy!#Hens lay eggs and keep them warm until chicks hatch out!#A rooster says cock-a-doodle-doo, and a hen says cluck cluck! 🐔
g Murgi daane, beej aur keede khaati hai. 🐔#Murgiyan kheton mein aur dadbe mein rehti hain.#Murgi ke bachche ko chooza kehte hain — peela aur rui jaisa naram!#Murgi ande deti hai, aur unhe garam rakhkar unmein se choozey nikaalti hai!#Murga bolta hai kukdoo-koo, aur murgi bolti hai kut-kut! 🐔
~duck 🦆 बत्तख,duck,ducks,duckling,ducklings,battakh,batakh,=batak
h बत्तख घास, कीड़े, छोटी मछलियाँ और दाने खाती है। 🦆#बत्तखें तालाब और नदी के पास रहती हैं।#बत्तख के बच्चे माँ के पीछे-पीछे लाइन में तैरते हैं!#बत्तख के पंख पानी में भीगते नहीं, इसलिए वो मज़े से तैरती है!#बत्तख बोलती है — क्वैक-क्वैक! 🦆
e Ducks eat grass, bugs, small fish and grains. 🦆#Ducks live near ponds and rivers.#Baby ducks are called ducklings, and they swim in a line behind their mummy!#A duck's feathers don't get soggy in water, so it swims happily!#A duck says quack quack! 🦆
g Battakh ghaas, keede, chhoti machhliyan aur daane khaati hai. 🦆#Battakhein taalaab aur nadi ke paas rehti hain.#Battakh ke bachche maa ke peeche-peeche line mein tairte hain!#Battakh ke pankh paani mein bheegte nahi, isliye woh maze se tairti hai!#Battakh bolti hai — quack quack! 🦆
~pigeon 🕊️ कबूतर,pigeon,pigeons,dove,doves,kabutar,kabootar
h कबूतर दाने और बीज खाते हैं। 🕊️#कबूतर छतों, खिड़कियों और ऊँची इमारतों पर रहते हैं।#कबूतर के बच्चे घोंसले में रहते हैं, और माँ-पापा उन्हें खास दूध जैसा खाना खिलाते हैं!#कबूतर बहुत दूर से भी अपना घर ढूँढ लेते हैं, पहले वो चिट्ठियाँ भी ले जाते थे!#कबूतर बोलता है — गुटर-गूँ! 🕊️
e Pigeons eat grains and seeds. 🕊️#Pigeons live on rooftops, windowsills and tall buildings.#Baby pigeons are called squabs, and their parents feed them a special milky food!#Pigeons can find their way home from very far — long ago they even carried letters!#A pigeon says coo coo! 🕊️
g Kabootar daane aur beej khaate hain. 🕊️#Kabootar chhaton, khidkiyon aur oonchi imaaraton par rehte hain.#Kabootar ke bachche ghonsle mein rehte hain, aur maa-papa unhe khaas doodh jaisa khaana khilaate hain!#Kabootar bahut door se bhi apna ghar dhoondh lete hain, pehle woh chitthiyan bhi le jaate the!#Kabootar bolta hai — gutar-goon! 🕊️
~sparrow 🐦 गौरैया,चिडिया,चिडियां,sparrow,sparrows,chidiya,chiriya,gauraiya,goraiya
h गौरैया दाने, बीज और छोटे कीड़े खाती है। 🐦#गौरैया हमारे घरों के आसपास, छोटे-छोटे घोंसलों में रहती है।#गौरैया के बच्चे घोंसले में चीं-चीं करके खाना माँगते हैं!#गौरैया हमारी पुरानी दोस्त है, गर्मी में उसके लिए पानी का कटोरा रखना!#गौरैया बोलती है — चीं-चीं! 🐦
e Sparrows eat grains, seeds and tiny bugs. 🐦#Sparrows live near our homes in little nests.#Baby sparrows go cheep cheep in the nest to ask for food!#Sparrows are our old friends — in summer, keep a little bowl of water out for them!#A sparrow says cheep cheep! 🐦
g Gauraiya daane, beej aur chhote keede khaati hai. 🐦#Gauraiya hamare gharon ke aas-paas, chhote-chhote ghonslon mein rehti hai.#Gauraiya ke bachche ghonsle mein cheen-cheen karke khaana maangte hain!#Gauraiya hamari puraani dost hai, garmi mein uske liye paani ka katora rakhna!#Gauraiya bolti hai — cheen cheen! 🐦
~butterfly 🦋 तितली,तितलियां,butterfly,butterflies,titli,titliyan
h तितली फूलों का मीठा रस पीती है। 🦋#तितलियाँ बगीचों में, फूलों के आसपास रहती हैं।#तितली का बच्चा इल्ली होता है, जो पत्ते खाकर बड़ी होती है और फिर तितली बन जाती है!#तितली अपने पैरों से स्वाद चखती है!#तितली कोई आवाज़ नहीं करती, बस चुपचाप फुर्र से उड़ जाती है! 🦋
e Butterflies sip sweet nectar from flowers. 🦋#Butterflies live in gardens, near flowers.#A baby butterfly is a caterpillar — it munches leaves, grows big, and then turns into a butterfly!#Butterflies taste with their feet!#Butterflies make no sound — they just flutter away quietly! 🦋
g Titli phoolon ka meetha ras peeti hai. 🦋#Titliyan bageechon mein, phoolon ke aas-paas rehti hain.#Titli ka bachcha illi hota hai, jo patte khaakar badi hoti hai aur phir titli ban jaati hai!#Titli apne pairon se swaad chakhti hai!#Titli koi awaaz nahi karti, bas chupchaap phurr se ud jaati hai! 🦋
~bee 🐝 मधुमक्खी,मधुमक्खियां,bee,bees,honeybee,madhumakhi,madhumakkhi
h मधुमक्खी फूलों का रस और पराग खाती है। 🐝#मधुमक्खियाँ छत्ते में हज़ारों की गिनती में साथ रहती हैं।#मधुमक्खी के बच्चे छत्ते के छोटे-छोटे खानों में बड़े होते हैं।#मधुमक्खियाँ फूलों के रस से मीठा शहद बनाती हैं! 🐝 उन्हें दूर से देखना, छेड़ना नहीं।#मधुमक्खी भिनभिनाती है — भिन-भिन! 🐝
e Bees eat nectar and pollen from flowers. 🐝#Bees live together in a hive — thousands of them!#Baby bees grow up in tiny rooms inside the hive.#Bees make sweet honey from flower nectar! 🐝 Watch them from far away and don't disturb them.#A bee buzzes — bzzz! 🐝
g Madhumakkhi phoolon ka ras aur paraag khaati hai. 🐝#Madhumakkhiyan chhatte mein hazaaron ki ginti mein saath rehti hain.#Madhumakkhi ke bachche chhatte ke chhote-chhote khaanon mein bade hote hain.#Madhumakkhiyan phoolon ke ras se meetha shahad banaati hain! 🐝 Unhe door se dekhna, chhedna nahi.#Madhumakkhi bhinbhinaati hai — bhin bhin! 🐝
~ant 🐜 चींटी,चींटियां,चींटियों,चीटी,=ant,ants,chinti,cheenti,=chiti,chintiyan,cheentiyan
h चींटियाँ मीठा, दाने और खाने के छोटे टुकड़े खाती हैं। 🐜#चींटियाँ ज़मीन के अंदर बिल में बड़े परिवार के साथ रहती हैं।#चींटी के बच्चे अंडों से निकलते हैं और बिल में बड़े होते हैं।#चींटी अपने वज़न से कई गुना भारी चीज़ उठा सकती है!#चींटी इतनी धीमी आवाज़ करती है कि हम सुन ही नहीं पाते! 🐜
e Ants eat sweet things, seeds and tiny crumbs of food. 🐜#Ants live under the ground in big family homes called colonies.#Baby ants hatch from eggs and grow up in the nest.#An ant can lift things many times heavier than itself!#Ants make sounds so tiny that we can't hear them! 🐜
g Cheentiyan meetha, daane aur khaane ke chhote tukde khaati hain. 🐜#Cheentiyan zameen ke andar bil mein bade parivaar ke saath rehti hain.#Cheenti ke bachche andon se nikalte hain aur bil mein bade hote hain.#Cheenti apne vazan se kai guna bhaari cheez utha sakti hai!#Cheenti itni dheemi awaaz karti hai ki hum sun hi nahi paate! 🐜
~spider 🕷️ मकडी,मकडियां,spider,spiders,makdi,makadi,makdiyan
h मकड़ी मक्खियाँ और छोटे कीड़े खाती है, जो उसके जाले में फँस जाते हैं। 🕷️#मकड़ी अपने बनाए जाले में, कोनों में और पेड़ों पर रहती है।#मकड़ी के बच्चे अंडों की एक छोटी-सी थैली से निकलते हैं!#मकड़ी के आठ पैर होते हैं, और वो अपने शरीर से रेशम जैसा धागा बनाती है!#मकड़ी चुपचाप रहती है, कोई आवाज़ नहीं करती! 🕷️
e Spiders eat flies and little bugs that get caught in their webs. 🕷️#Spiders live in their webs, in corners and in trees.#Baby spiders are called spiderlings, and they hatch from a little egg sac!#Spiders have eight legs, and they make silky thread from their bodies!#Spiders are quiet — they make no sound! 🕷️
g Makdi makkhiyan aur chhote keede khaati hai, jo uske jaale mein phans jaate hain. 🕷️#Makdi apne banaaye jaale mein, konon mein aur pedon par rehti hai.#Makdi ke bachche andon ki ek chhoti si thaili se nikalte hain!#Makdi ke aath pair hote hain, aur woh apne shareer se resham jaisa dhaaga banaati hai!#Makdi chupchaap rehti hai, koi awaaz nahi karti! 🕷️
~kangaroo 🦘 कंगारू,kangaroo,kangaroos,kangaru
h कंगारू घास और पत्तियाँ खाता है। 🦘#कंगारू ऑस्ट्रेलिया में रहते हैं।#कंगारू के बच्चे को जोई कहते हैं, और वो माँ के पेट वाली थैली में रहता है!#कंगारू चलता नहीं, बड़ी-बड़ी छलाँगें लगाकर कूदता है!#कंगारू खाँसने जैसी, क्लिक-क्लिक आवाज़ करता है! 🦘
e Kangaroos eat grass and leaves. 🦘#Kangaroos live in Australia.#A baby kangaroo is called a joey, and it rides in its mummy's tummy pouch!#Kangaroos don't walk — they hop with giant jumps!#Kangaroos make clicking and coughing sounds! 🦘
g Kangaroo ghaas aur pattiyan khaata hai. 🦘#Kangaroo Australia mein rehte hain.#Kangaroo ke bachche ko joey kehte hain, aur woh maa ke pet wali thaili mein rehta hai!#Kangaroo chalta nahi, badi-badi chhalaangein lagakar koodta hai!#Kangaroo khaansne jaisi, click-click awaaz karta hai! 🦘
~panda 🐼 पांडा,panda,pandas
h पांडा बाँस खाता है — दिन भर बाँस ही बाँस! 🐼#पांडा चीन के पहाड़ी जंगलों में रहते हैं।#पांडा का बच्चा पैदा होते समय बहुत छोटा और गुलाबी होता है!#पांडा का काला-सफ़ेद रंग बहुत प्यारा है, और वो पेड़ों पर चढ़ भी लेता है!#पांडा मिमियाता है और भौंकने जैसी आवाज़ भी करता है! 🐼
e Pandas eat bamboo — lots and lots of bamboo! 🐼#Pandas live in mountain forests in China.#A baby panda is called a cub — it's born tiny and pink!#Pandas have lovely black-and-white fur, and they can climb trees too!#Pandas bleat and even make little barking sounds! 🐼
g Panda baans khaata hai — din bhar baans hi baans! 🐼#Panda China ke pahaadi jangalon mein rehte hain.#Panda ka bachcha paida hote samay bahut chhota aur gulaabi hota hai!#Panda ka kaala-safed rang bahut pyaara hai, aur woh pedon par chadh bhi leta hai!#Panda mimiyata hai aur bhaunkne jaisi awaaz bhi karta hai! 🐼
`);

  macro("DOG", "कुत्त,dog,dogs,puppy,kutta,kutte");
  macro("BIRD", "पक्षी,परिंद,चिडिया,चिडियां,बर्ड,bird,birds,pakshi,parinde,chidiya,chidiyan,chidiyaan");
  macro("FISH", "मछली,मछलियां,fish,fishes,machli,machhli,machhliyan");
  macro("ANIMAL", "जानवर,जानवरों,पशु,जीव,animal,animals,janwar,jaanwar,janwaron,jaanwaron,=pashu,=jeev");

  def("animals", `
@dog_bark $DOG + भौंक,bark,barks,barking,bhonk,bhaunk,bhonkte,bhaunkte
h कुत्ते भौंककर अपनी बात कहते हैं, जैसे कोई आया है या उन्हें खेलना है! 🐶 वो हमारी तरह बोल नहीं सकते।
e Dogs bark to tell us things, like someone is at the door or they want to play! 🐶 They can't talk like us.
g Kutte bhaunkkar apni baat kehte hain, jaise koi aaya hai ya unhe khelna hai! 🐶 Woh hamari tarah bol nahi sakte.
@dog_tail $DOG + पूंछ,tail,tails,poonch,punch,wag,wags,hila
h कुत्ता खुश होता है तो पूँछ हिलाता है! 🐕 पूँछ से वो अपने मन की बात बताता है।
e Dogs wag their tails when they're happy! 🐕 A tail is how a dog shows its feelings.
g Kutta khush hota hai toh poonch hilaata hai! 🐕 Poonch se woh apne mann ki baat bataata hai.
@cat_purr बिल्ल,cat,cats,billi + घुर्र,purr,purrs,purring,ghurr,ghur
h बिल्ली खुश और आराम में होती है तो घुर्र-घुर्र करती है! 🐱 ये उसका मुस्कुराने का तरीका है।
e Cats purr when they feel happy and cosy! 🐱 It's their way of smiling.
g Billi khush aur aaraam mein hoti hai toh ghurr-ghurr karti hai! 🐱 Yeh uska muskurane ka tareeka hai.
@bird_fly $BIRD + उडती,उडते,उडता,उडना,उड सक,उड पा,fly,flies,flying,udti,udte,udta,udna,ud sakte
h पक्षियों के पंख होते हैं और उनकी हड्डियाँ बहुत हल्की होती हैं, इसलिए वो उड़ पाते हैं! 🐦 वो पंख फड़फड़ाकर हवा को नीचे धकेलते हैं।
e Birds have wings and very light bones, so they can fly! 🐦 They flap their wings to push the air down.
g Pakshiyon ke pankh hote hain aur unki haddiyan bahut halki hoti hain, isliye woh ud paate hain! 🐦 Woh pankh phadphadakar hawa ko neeche dhakelte hain.
@bird_nest $BIRD + घोंसल,nest,nests,ghonsla,ghonsle
h पक्षी घोंसला बनाते हैं ताकि उनके अंडे और बच्चे सुरक्षित और गर्म रहें! 🪺 वो तिनके, पत्ते और धागे चोंच में उठाकर लाते हैं।
e Birds build nests to keep their eggs and babies safe and warm! 🪺 They carry twigs, leaves and bits of string in their beaks.
g Pakshi ghonsla banaate hain taaki unke ande aur bachche surakshit aur garam rahein! 🪺 Woh tinke, patte aur dhaage chonch mein uthaakar laate hain.
@bird_sing $BIRD + गाती,गाते,गाना,चहच,sing,sings,singing,chirp,chirping,gaati,gaate,chehak,chahak
h चिड़ियाँ गाकर अपने दोस्तों को बुलाती हैं और सुबह का हैलो कहती हैं! 🐦 हर चिड़िया का गाना अलग होता है।
e Birds sing to call their friends and say good morning! 🐦 Every bird has its own song.
g Chidiyaan gaakar apne doston ko bulaati hain aur subah ka hello kehti hain! 🐦 Har chidiya ka gaana alag hota hai.
@fish_breathe $FISH + सांस,breathe,breathing,breath,saans,=sans,डूबती,drown,dubti
h मछलियाँ गलफड़ों से साँस लेती हैं — वो पानी में घुली हवा ले लेती हैं! 🐟 इसलिए वो पानी में आराम से रहती हैं।
e Fish breathe with their gills — they take in the air that's mixed into the water! 🐟 That's why they're happy under water.
g Machhliyan galphadon se saans leti hain — woh paani mein ghuli hawa le leti hain! 🐟 Isliye woh paani mein aaraam se rehti hain.
@fish_sleep $FISH + सोती,सोते,नींद,sleep,sleeps,sleeping,soti,sote,neend
h हाँ, मछलियाँ भी आराम करती हैं! 🐟 उनकी पलकें नहीं होतीं, इसलिए वो आँखें खोलकर ही आराम कर लेती हैं।
e Yes, fish rest too! 🐟 They have no eyelids, so they rest with their eyes open.
g Haan, machhliyan bhi aaraam karti hain! 🐟 Unki palkein nahi hoti, isliye woh aankhein kholkar hi aaraam kar leti hain.
@animals_sleep $ANIMAL + सोते,सोता,सोती,नींद,sleep,sleeps,sote,sota,soti,neend
h हाँ, सब जानवर सोते हैं, बिल्कुल हमारी तरह! 😴 कोई दिन में सोता है, कोई रात में — जैसे उल्लू दिन में सोता है।
e Yes, all animals sleep, just like us! 😴 Some sleep in the day and some at night — owls sleep in the daytime.
g Haan, sab jaanwar sote hain, bilkul hamari tarah! 😴 Koi din mein sota hai, koi raat mein — jaise ullu din mein sota hai.
@animals_talk $ANIMAL + बात,बोल सकते,बोलते,talk,talking,speak,baat,bol sakte,bolte
h जानवर हमारी तरह शब्द नहीं बोलते, पर आवाज़ों और इशारों से आपस में बात करते हैं! 🐾 जैसे कुत्ता पूँछ हिलाकर खुशी बताता है।
e Animals don't use words like us, but they talk to each other with sounds and moves! 🐾 A dog wags its tail to say it's happy.
g Jaanwar hamari tarah shabd nahi bolte, par awaazon aur ishaaron se aapas mein baat karte hain! 🐾 Jaise kutta poonch hilaakar khushi bataata hai.
@animals_feel $ANIMAL + महसूस,खुश,प्यार,feel,feelings,happy,love,mehsoos,khush,pyaar
h हाँ, जानवर भी खुशी, डर और प्यार महसूस करते हैं! 🐾 इसलिए हमें उनसे हमेशा प्यार से पेश आना चाहिए।
e Yes, animals feel happy, scared and loved too! 🐾 That's why we should always be gentle with them.
g Haan, jaanwar bhi khushi, darr aur pyaar mehsoos karte hain! 🐾 Isliye humein unse hamesha pyaar se pesh aana chahiye.
@giraffe_neck जिराफ,giraffe,giraffes,jiraf + गर्दन,neck,gardan
h लंबी गर्दन से जिराफ़ ऊँचे पेड़ों की पत्तियाँ आराम से खा लेता है! 🦒 वहाँ तक कोई और जानवर नहीं पहुँचता।
e A long neck helps the giraffe eat leaves from the tallest trees! 🦒 No other animal can reach up there.
g Lambi gardan se giraffe oonche pedon ki pattiyan aaraam se kha leta hai! 🦒 Wahan tak koi aur jaanwar nahi pahunchta.
@zebra_stripes जेबरा,zebra,zebras,jebra + धारी,धारियां,stripe,stripes,dhari,dhaari,dhariyan
h वैज्ञानिक मानते हैं कि ज़ेबरा की धारियाँ काटने वाली मक्खियों को दूर रखती हैं! 🦓 झुंड में भागते ज़ेबरा की धारियाँ पीछा करने वालों को उलझा भी देती हैं।
e Scientists think zebra stripes help keep biting flies away! 🦓 And a running herd of stripes confuses animals that chase them.
g Scientist maante hain ki zebra ki dhaariyan kaatne wali makkhiyon ko door rakhti hain! 🦓 Jhund mein bhaagte zebra ki dhaariyan peechha karne waalon ko uljha bhi deti hain.
@elephant_trunk हाथी,elephant,elephants,hathi,haathi + सूंड,trunk,trunks,soond,sund
h हाथी की सूँड उसकी नाक और ऊपर वाला होंठ है — उससे वो साँस लेता, सूँघता, पानी पीता और चीज़ें उठाता है! 🐘 सूँड उसका जादुई हाथ है।
e An elephant's trunk is its nose and top lip together — it breathes, smells, drinks and picks things up with it! 🐘 It's like a magic hand.
g Haathi ki soond uski naak aur upar wala honth hai — usse woh saans leta, soonghta, paani peeta aur cheezein uthaata hai! 🐘 Soond uska jaadui haath hai.
@camel_hump ऊंट,camel,camels,=unt,=oont + कूबड,hump,humps,kubad,koobad
h ऊँट के कूबड़ में चर्बी जमा रहती है, जो लंबे सफ़र में उसे ताक़त देती है! 🐪 उसमें पानी नहीं होता, बहुत लोग गलत समझते हैं।
e A camel's hump is a store of energy food that keeps it going on long trips! 🐪 It doesn't hold water, even though many people think so.
g Oont ke koobad mein charbi jama rehti hai, jo lambe safar mein use taakat deti hai! 🐪 Usmein paani nahi hota, bahut log galat samajhte hain.
@cow_milk गाय,गायें,भैंस,cow,cows,buffalo,gaay,bhains + दूध,milk,doodh,=dudh
h गाय अपने बछड़े को पिलाने के लिए दूध बनाती है! 🐄 बछड़ा भर पेट पी ले, तो किसान बाकी दूध हमारे लिए निकालते हैं।
e A cow makes milk to feed her baby calf! 🐄 After the calf has had enough, farmers collect the extra milk for us.
g Gaay apne bachhde ko pilaane ke liye doodh banaati hai! 🐄 Bachhda bhar pet pee le, toh kisaan baaki doodh hamare liye nikaalte hain.
@owl_night उल्लू,owl,owls,=ullu + $NIGHT,जाग,awake,jaag
h उल्लू की आँखें अँधेरे में भी अच्छे से देख लेती हैं, इसलिए वो रात को जागकर खाना ढूँढता है! 🦉 और दिन में आराम करता है।
e Owls have eyes that see well in the dark, so they stay awake at night to find food! 🦉 Then they rest in the daytime.
g Ullu ki aankhein andhere mein bhi achhe se dekh leti hain, isliye woh raat ko jaagkar khaana dhoondhta hai! 🦉 Aur din mein aaraam karta hai.
@honey शहद,honey,shahad,=madhu + बनाती,बनाते,बनता,बनती,make,makes,made,banati,banate,banta,कहां से,kahan se,=from,where
h मधुमक्खियाँ फूलों का मीठा रस इकट्ठा करके छत्ते में लाती हैं और उसे शहद बना देती हैं! 🍯 एक चम्मच शहद के लिए बहुत सारी मधुमक्खियाँ मेहनत करती हैं।
e Bees collect sweet nectar from flowers, carry it to the hive and turn it into honey! 🍯 Lots of bees work together to make just one spoonful.
g Madhumakkhiyan phoolon ka meetha ras ikattha karke chhatte mein laati hain aur use shahad bana deti hain! 🍯 Ek chammach shahad ke liye bahut saari madhumakkhiyan mehnat karti hain.
@ant_line चींटी,चींटियां,चीटी,=ant,ants,cheenti,chinti,cheentiyan + लाइन,कतार,line,lines,row,qatar,katar
h चींटियाँ चलते-चलते एक खास खुशबू छोड़ती हैं, और पीछे वाली उसी खुशबू को सूँघकर लाइन में चलती हैं! 🐜 जैसे खुशबू वाला रास्ता।
e Ants leave a special smell as they walk, and the ants behind follow that smell in a line! 🐜 It's like a scented path.
g Cheentiyan chalte-chalte ek khaas khushboo chhodti hain, aur peeche wali usi khushboo ko soonghkar line mein chalti hain! 🐜 Jaise khushboo wala raasta.
@spider_web मकडी,spider,spiders,makdi + जाला,जाले,=जाल,web,webs,jaala,=jala,=jaal,=jal
h मकड़ी अपने शरीर से बने रेशमी धागे से जाला बुनती है, उसी में वो रहती है और खाना पकड़ती है! 🕸️ जाला बहुत मज़बूत होता है।
e A spider spins a web from silky thread made in its body — it lives in it and catches food with it! 🕸️ Webs are super strong.
g Makdi apne shareer se bane reshmi dhaage se jaala bunti hai, usi mein woh rehti hai aur khaana pakadti hai! 🕸️ Jaala bahut mazboot hota hai.
@snake_legs सांप,snake,snakes,saanp + पैर,=leg,legs,=pair,=pair
h साँप अपने पेट की खास पपड़ी से ज़मीन पकड़कर लहराते हुए आगे बढ़ते हैं, उन्हें पैरों की ज़रूरत ही नहीं! 🐍 बहुत पहले उनके पूर्वजों के छोटे पैर होते थे।
e Snakes wiggle along, gripping the ground with special scales on their tummies — they don't need legs! 🐍 Long, long ago, their great-great-grandparents had tiny legs.
g Saanp apne pet ki khaas papdi se zameen pakadkar lehraate hue aage badhte hain, unhe pairon ki zaroorat hi nahi! 🐍 Bahut pehle unke poorvajon ke chhote pair hote the.
@peacock_dance मोर,peacock,peacocks,=mor + नाच,dance,dances,dancing,naach,=nach,nachta
h मोर अपने सुंदर पंख फैलाकर नाचता है, जैसे कह रहा हो — देखो मैं कितना सुंदर हूँ! 🦚 बादल और बारिश आने पर वो खूब नाचता है।
e The peacock spreads its beautiful feathers and dances, as if saying, look how lovely I am! 🦚 It dances a lot when clouds and rain come.
g Mor apne sundar pankh phailakar naachta hai, jaise keh raha ho — dekho main kitna sundar hoon! 🦚 Baadal aur baarish aane par woh khoob naachta hai.
@parrot_talk तोता,तोते,parrot,parrots,=tota,=tote + बोलता,बोलते,बोल लेत,नकल,talk,talks,speak,copy,bolta,bolte,nakal + $HOW,$WHY,सकता,सकते,=can,sakta,sakte
h तोते बहुत ध्यान से सुनते हैं और आवाज़ों की नकल कर लेते हैं! 🦜 वो सुनी हुई बात बार-बार दोहराकर सीखते हैं — जैसे तुम कविता सीखते हो।
e Parrots listen very carefully and copy the sounds they hear! 🦜 They learn by saying them again and again — like you learn a rhyme.
g Tote bahut dhyan se sunte hain aur awaazon ki nakal kar lete hain! 🦜 Woh suni hui baat baar-baar dohraakar seekhte hain — jaise tum kavita seekhte ho.
@caterpillar इल्ली,सुंडी,caterpillar,caterpillars,=illi
h इल्ली खूब पत्ते खाती है, फिर अपने चारों ओर एक खोल बनाकर आराम करती है! 🐛 कुछ दिनों बाद उसमें से सुंदर तितली निकलती है।
e A caterpillar eats lots of leaves, then wraps itself in a little case and rests! 🐛 Some days later, a beautiful butterfly comes out.
g Illi khoob patte khaati hai, phir apne chaaron or ek khol banakar aaraam karti hai! 🐛 Kuch dinon baad usmein se sundar titli nikalti hai.
@dinosaur डायनासोर,डाइनासोर,dinosaur,dinosaurs,=dino,dinos,dainasor
h डायनासोर बहुत-बहुत पहले धरती पर रहते थे, अब वो नहीं हैं! 🦖 हमें उनकी हड्डियों से पता चलता है कि वो कैसे थे। आज की चिड़ियाँ उनकी दूर की रिश्तेदार हैं।
e Dinosaurs lived on Earth a very, very long time ago — they're not around anymore! 🦖 We learn about them from their bones. Today's birds are their faraway cousins.
g Dinosaur bahut-bahut pehle dharti par rehte the, ab woh nahi hain! 🦖 Humein unki haddiyon se pata chalta hai ki woh kaise the. Aaj ki chidiyaan unki door ki rishtedaar hain.
@dinosaur_gone डायनासोर,dinosaur,dinosaurs,=dino,dinos + कहां,गए,खत्म,where,gone,happened,disappear,kahan,gaye,khatam
h बहुत पहले अंतरिक्ष से एक बड़ा पत्थर धरती पर गिरा और मौसम बदल गया, तो डायनासोर धीरे-धीरे खत्म हो गए! 🦖 पर उनकी रिश्तेदार चिड़ियाँ आज भी हमारे साथ हैं।
e Long ago, a huge space rock hit the Earth and the weather changed, so the dinosaurs slowly disappeared! 🦖 But their cousins, the birds, are still with us.
g Bahut pehle antariksh se ek bada patthar dharti par gira aur mausam badal gaya, toh dinosaur dheere-dheere khatam ho gaye! 🦖 Par unki rishtedaar chidiyaan aaj bhi hamare saath hain.
@biggest_animal सबसे बडा,सबसे बडी,biggest,largest,sabse bada,sabse badi + $ANIMAL
h नीली व्हेल दुनिया का सबसे बड़ा जानवर है! 🐋 ज़मीन पर सबसे बड़ा जानवर हाथी है।
e The blue whale is the biggest animal in the world! 🐋 On land, the biggest is the elephant.
g Neeli whale duniya ka sabse bada jaanwar hai! 🐋 Zameen par sabse bada jaanwar haathi hai.
@fastest_animal सबसे तेज,fastest,sabse tej + $ANIMAL,दौड,runner,daud
h चीता ज़मीन पर सबसे तेज़ दौड़ने वाला जानवर है — सड़क पर चलती कार जितना तेज़! 🐆 और आसमान में बाज़ सबसे तेज़ उड़ता है।
e The cheetah is the fastest runner on land — as fast as a car on the road! 🐆 In the sky, the falcon is the fastest.
g Cheetah zameen par sabse tez daudne wala jaanwar hai — sadak par chalti car jitna tez! 🐆 Aur aasmaan mein baaz sabse tez udta hai.
@animal_tails पूंछ,tail,tails,poonch + $WHY,$ANIMAL
h पूँछ बहुत काम की चीज़ है! 🐒 बंदर उससे डाल पकड़ता है, गाय मक्खियाँ भगाती है, और कुत्ता अपनी खुशी बताता है।
e Tails are super useful! 🐒 Monkeys hold branches with them, cows swish away flies, and dogs show they're happy.
g Poonch bahut kaam ki cheez hai! 🐒 Bandar usse daal pakadta hai, gaay makkhiyan bhagaati hai, aur kutta apni khushi bataata hai.
@eggs अंडा,अंडे,=egg,eggs,=anda,=ande + $WHERE,$WHO,कहां से,देता,देती,देते,=lay,lays,=from,deta,deti,dete
h अंडे मुर्गी जैसे पक्षी देते हैं! 🥚 मछली, कछुए, साँप और मेंढक भी अंडे देते हैं, और उनमें से बच्चे निकलते हैं।
e Eggs come from birds like hens! 🥚 Fish, turtles, snakes and frogs lay eggs too, and babies hatch out of them.
g Ande murgi jaise pakshi dete hain! 🥚 Machhli, kachhue, saanp aur mendhak bhi ande dete hain, aur unmein se bachche nikalte hain.
@pet_care पालतू,pet,pets,paltu,paaltu + ख्याल,देखभाल,care,look after,khayal,dekhbhal,$HOW
h पालतू जानवर को समय पर खाना, साफ़ पानी, प्यार और खेलने का समय चाहिए! 🐾 उसकी देखभाल हमेशा बड़ों के साथ मिलकर करना।
e A pet needs food on time, clean water, love and playtime! 🐾 Always look after a pet together with a grown-up.
g Paaltu jaanwar ko samay par khaana, saaf paani, pyaar aur khelne ka samay chahiye! 🐾 Uski dekhbhaal hamesha badon ke saath milkar karna.
@zoo चिडियाघर,=zoo,chidiyaghar
h चिड़ियाघर में बहुत सारे जानवर रहते हैं, और वहाँ के लोग उनका ध्यान रखते हैं! 🦒 वहाँ हम उन्हें सुरक्षित दूरी से देख सकते हैं।
e A zoo is a place where lots of animals live and people take care of them! 🦒 We can see them there from a safe distance.
g Chidiyaghar mein bahut saare jaanwar rehte hain, aur wahan ke log unka dhyan rakhte hain! 🦒 Wahan hum unhe surakshit doori se dekh sakte hain.
@insects ? कीडे,कीडा,कीट,insect,insects,=bug,bugs,keede,keeda,=keet
h कीड़े छोटे-छोटे जीव हैं, जिनके छह पैर होते हैं — जैसे चींटी, तितली और मधुमक्खी! 🐞 कई कीड़े फूलों और पौधों की मदद करते हैं।
e Insects are little creatures with six legs — like ants, butterflies and bees! 🐞 Many insects help flowers and plants.
g Keede chhote-chhote jeev hain, jinke chhah pair hote hain — jaise cheenti, titli aur madhumakkhi! 🐞 Kai keede phoolon aur paudhon ki madad karte hain.
@mosquito मच्छर,mosquito,mosquitoes,machhar,machchar
h मच्छर छोटे उड़ने वाले कीड़े हैं जो रुके हुए पानी के पास पनपते हैं! 🦟 इसलिए घर के आसपास पानी जमा नहीं होने देते।
e Mosquitoes are tiny flying insects that grow near still water! 🦟 That's why we don't let water collect around the house.
g Machchhar chhote udne wale keede hain jo ruke hue paani ke paas panapte hain! 🦟 Isliye ghar ke aas-paas paani jama nahi hone dete.
`);

  macro("PLANT", "पौध,पेड,प्लांट,plant,plants,tree,trees,paudha,paudhe,paudhon,=ped,pedon,=pedh");
  macro("FRUIT", "=फल,फलों,fruit,fruits,=phal,phalon");
  macro("VEG", "सब्जी,सब्जियां,सब्जियों,vegetable,vegetables,veggies,veggie,sabzi,sabji,sabziyan,sabziyon");

  def("plants", `
@leaves_green $PLANT,पत्त,घास,leaf,leaves,grass,patte,patta,pattiyan,ghaas + हरा,हरे,हरी,green,=hara,=hare,=hari
h पत्तों में क्लोरोफ़िल नाम का हरा रंग होता है! 🌿 उसी की मदद से पेड़ धूप से अपना खाना बनाते हैं।
e Leaves have a green colour inside called chlorophyll! 🌿 It helps plants make their food from sunlight.
g Patton mein chlorophyll naam ka hara rang hota hai! 🌿 Usi ki madad se ped dhoop se apna khaana banaate hain.
@plant_grow $PLANT + उगते,उगता,उगती,बढते,बढता,बडे होते,grow,grows,growing,ugte,ugta,ugti,badhte,badhta
h बीज को मिट्टी, पानी और धूप मिले, तो उसमें से नन्हा पौधा निकलता है! 🌱 फिर वो रोज़ थोड़ा-थोड़ा बड़ा होता है।
e When a seed gets soil, water and sunshine, a tiny plant pops out! 🌱 Then it grows a little bit every day.
g Beej ko mitti, paani aur dhoop mile, toh usmein se nanha paudha nikalta hai! 🌱 Phir woh roz thoda-thoda bada hota hai.
@plant_food $PLANT + $EAT,पीते,पानी,drink,drinks,water,peete
h पौधे धूप, पानी और हवा से अपना खाना खुद बनाते हैं! ☀️ उनकी जड़ें मिट्टी से पानी पीती हैं।
e Plants make their own food from sunlight, water and air! ☀️ Their roots drink water from the soil.
g Paudhe dhoop, paani aur hawa se apna khaana khud banaate hain! ☀️ Unki jadein mitti se paani peeti hain.
@trees_why $PLANT + जरूरी,जरूरत,important,useful,फायदा,=fayda,=faida,लगाने,लगाना,बचाना,=save,plant trees,why trees,lagana,bachana,zaruri,jaruri
h पेड़ हमें साँस लेने वाली साफ़ हवा, छाया, फल और चिड़ियों को घर देते हैं! 🌳 इसलिए पेड़ लगाना और बचाना बहुत अच्छा काम है।
e Trees give us fresh air to breathe, shade, fruits, and homes for birds! 🌳 Planting and saving trees is a wonderful thing to do.
g Ped humein saans lene wali saaf hawa, chhaya, phal aur chidiyon ko ghar dete hain! 🌳 Isliye ped lagaana aur bachaana bahut achha kaam hai.
@flower_smell फूल,flower,flowers,=phool,=ful,=fool,phoolon + खुशबू,महक,सुगंध,smell,smells,khushbu,mehak,sugandh
h फूल अपनी खुशबू से तितलियों और मधुमक्खियों को बुलाते हैं! 🌸 वो रस पीने आती हैं और फूलों को बीज बनाने में मदद करती हैं।
e Flowers use their sweet smell to invite butterflies and bees! 🌸 They come for nectar and help the flowers make seeds.
g Phool apni khushboo se titliyon aur madhumakkhiyon ko bulaate hain! 🌸 Woh ras peene aati hain aur phoolon ko beej banaane mein madad karti hain.
@flower_colours फूल,flower,flowers,=phool,phoolon + रंग,रंगीन,colour,colours,color,colors,colourful,colorful,=rang,rangeen
h चटक रंगों की वजह से तितलियाँ और मधुमक्खियाँ फूलों को दूर से ही देख लेती हैं! 🌼 रंग-बिरंगे फूल मानो कहते हैं — आओ, यहाँ मीठा रस है।
e Bright colours help bees and butterflies spot flowers from far away! 🌼 It's like the flower is saying, come here, there's sweet nectar.
g Chatak rangon ki wajah se titliyan aur madhumakkhiyan phoolon ko door se hi dekh leti hain! 🌼 Rang-birange phool maano kehte hain — aao, yahan meetha ras hai.
@seed =बीज,बीजों,seed,seeds,=beej,=bij
h बीज एक नन्हा-सा डिब्बा है, जिसके अंदर पूरा पौधा सोया होता है! 🌱 मिट्टी, पानी और धूप मिलते ही वो जाग जाता है।
e A seed is like a tiny box with a whole baby plant sleeping inside! 🌱 Give it soil, water and sunshine and it wakes up.
g Beej ek nanha sa dibba hai, jiske andar poora paudha soya hota hai! 🌱 Mitti, paani aur dhoop milte hi woh jaag jaata hai.
@fruit_where $FRUIT + कहां से,$WHERE,=from,उगते,grow,grows,ugte
h फल पेड़ों और पौधों पर उगते हैं! 🍎 पहले फूल खिलता है, फिर वही फूल धीरे-धीरे फल बन जाता है।
e Fruits grow on trees and plants! 🍎 First a flower blooms, then it slowly turns into a fruit.
g Phal pedon aur paudhon par ugte hain! 🍎 Pehle phool khilta hai, phir wahi phool dheere-dheere phal ban jaata hai.
@fruit_why $FRUIT + $WHY,जरूरी,healthy,=good,अच्छे,=achhe,should
h फलों में मीठा स्वाद और बहुत सारे विटामिन होते हैं, जो हमें तंदुरुस्त रखते हैं! 🍌 रोज़ एक फल खाना बड़ा मज़ेदार नियम है।
e Fruits are sweet and full of vitamins that keep us healthy! 🍌 Eating a fruit every day is a yummy habit.
g Phalon mein meetha swaad aur bahut saare vitamin hote hain, jo humein tandurust rakhte hain! 🍌 Roz ek phal khaana bada mazedaar niyam hai.
@fruit_sweet $FRUIT + मीठा,मीठे,sweet,meetha,meethe
h फल मीठे होते हैं ताकि जानवर और पक्षी उन्हें खाएँ और बीज दूर-दूर तक फैल जाएँ! 🍓 कच्चा फल खट्टा, पका फल मीठा।
e Fruits are sweet so animals and birds will eat them and spread the seeds far and wide! 🍓 Unripe fruit is sour, ripe fruit is sweet.
g Phal meethe hote hain taaki jaanwar aur pakshi unhe khaayein aur beej door-door tak phail jaayein! 🍓 Kachcha phal khatta, pakka phal meetha.
@veg_why $VEG + $WHY,जरूरी,healthy,=good,अच्छी,must,should,खानी,=khani,eat
h सब्ज़ियाँ हमारे शरीर को ताक़त देती हैं, जैसे गाड़ी को पेट्रोल! 🥦 उनसे हड्डियाँ, आँखें और पेट सब खुश रहते हैं।
e Vegetables give our bodies power, like fuel for a car! 🥦 They keep our bones, eyes and tummy happy.
g Sabziyan hamare shareer ko taakat deti hain, jaise gaadi ko petrol! 🥦 Unse haddiyan, aankhein aur pet sab khush rehte hain.
h हरी सब्ज़ियाँ खाकर शरीर पहलवान बनता है! 💪 हर रंग की सब्ज़ी अलग ताक़त देती है, इसलिए थाली रंग-बिरंगी रखो।
e Green vegetables make your body strong! 💪 Each colour gives a different kind of power, so make your plate colourful.
g Hari sabzi khaakar shareer pehalwan banta hai! 💪 Har rang ki sabzi alag taakat deti hai, isliye thaali rang-birangi rakho.
@milk_why दूध,milk,doodh,=dudh + $WHY,जरूरी,=good,healthy,पीना,पीते,drink,peena,peete - $ANIMALNAMES
h दूध हड्डियों और दाँतों को मज़बूत बनाता है! 🥛 उसमें कैल्शियम होता है, जो बढ़ते बच्चों के लिए बहुत अच्छा है।
e Milk makes bones and teeth strong! 🥛 It has calcium, which is great for growing children.
g Doodh haddiyon aur daanton ko mazboot banaata hai! 🥛 Usmein calcium hota hai, jo badhte bachchon ke liye bahut achha hai.
@milk_from दूध,milk,doodh,=dudh + कहां से,$WHERE,=from,आता,comes,aata
h दूध गाय, भैंस और बकरी जैसे जानवरों से आता है! 🐄 किसान दूध निकालते हैं, फिर वो दुकानों तक पहुँचता है।
e Milk comes from animals like cows, buffaloes and goats! 🐄 Farmers collect it, and then it travels to the shops.
g Doodh gaay, bhains aur bakri jaise jaanwaron se aata hai! 🐄 Kisaan doodh nikaalte hain, phir woh dukaanon tak pahunchta hai.
@water_why पानी,water,paani,=pani,=jal + $WHY,जरूरी,need,पीना,पीते,drink,peena,peete - $ANIMALNAMES,$PLANT
h हमारा शरीर बहुत सारे पानी से बना है, इसलिए उसे रोज़ पानी चाहिए! 💧 पानी पीकर हम ताज़ा रहते हैं, जैसे पौधे।
e Our body is made with lots of water, so it needs water every day! 💧 Drinking water keeps us fresh, just like plants.
g Hamara shareer bahut saare paani se bana hai, isliye use roz paani chahiye! 💧 Paani peekar hum taaza rehte hain, jaise paudhe.
@water_from पानी,water,paani,=pani,=नल,=tap,taps + कहां से,$WHERE,=from,आता,comes,aata
h हमारा पानी बारिश से आता है, जो नदियों, झीलों और ज़मीन के नीचे जमा होता है! 💧 फिर पाइप से वो हमारे नल तक आता है।
e Our water comes from rain, which fills rivers, lakes and the ground below! 💧 Then pipes bring it to our taps.
g Hamara paani baarish se aata hai, jo nadiyon, jheelon aur zameen ke neeche jama hota hai! 💧 Phir pipe se woh hamare nal tak aata hai.
@food_why खाना,खाते,भोजन,food,=eat,khana,khaana,khate + $WHY
h खाना हमारे शरीर का ईंधन है — उससे हम खेलते, सोचते और बड़े होते हैं! 🍛 जैसे गाड़ी पेट्रोल से चलती है।
e Food is fuel for our body — it helps us play, think and grow! 🍛 Just like a car needs fuel to go.
g Khaana hamare shareer ka fuel hai — usse hum khelte, sochte aur bade hote hain! 🍛 Jaise gaadi petrol se chalti hai.
@breakfast_why नाश्ता,नाश्ते,breakfast,nashta,naashta + $WHY,जरूरी,important
h सुबह का नाश्ता रात भर खाली रहे पेट को ताक़त देता है! 🥣 नाश्ता करके दिमाग भी तेज़ चलता है।
e Breakfast gives energy to a tummy that was empty all night! 🥣 It helps your brain work fast too.
g Subah ka naashta raat bhar khaali rahe pet ko taakat deta hai! 🥣 Naashta karke dimaag bhi tez chalta hai.
@roti रोटी,चपाती,=roti,chapati,chapatti + $HOW,बनती,=made,banti,कहां से,$WHERE
h रोटी गेहूँ के आटे से बनती है! 🫓 आटे में पानी मिलाकर गूँधते हैं, बेलते हैं, और तवे पर सेंकते हैं — ये काम बड़े करते हैं।
e Roti is made from wheat flour! 🫓 Flour and water make dough, it's rolled flat and cooked on a hot pan — a grown-up job.
g Roti gehun ke aate se banti hai! 🫓 Aate mein paani milakar goondhte hain, belte hain, aur tawe par senkte hain — yeh kaam bade karte hain.
@rice चावल,धान,=rice,chawal,chaawal,dhaan + $HOW,$WHERE,कहां से,उगता,grow,grows,ugta,=from,आता,aata
h चावल धान के पौधे से आता है, जो पानी भरे खेतों में उगता है! 🌾 किसान धान काटते हैं और उसमें से चावल निकालते हैं।
e Rice comes from the rice plant, which grows in fields full of water! 🌾 Farmers harvest it and take out the rice grains.
g Chawal dhaan ke paudhe se aata hai, jo paani bhare kheton mein ugta hai! 🌾 Kisaan dhaan kaatte hain aur usmein se chawal nikaalte hain.
@wheat गेहूं,आटा,wheat,flour,gehun,gehu,=atta
h गेहूँ खेतों में उगने वाली एक घास है, जिसकी बालियों में दाने होते हैं! 🌾 उन्हीं दानों को पीसकर आटा बनता है, जिससे रोटी बनती है।
e Wheat is a kind of grass that grows in fields, with grains on top! 🌾 The grains are ground into flour to make roti and bread.
g Gehun kheton mein ugne wali ek ghaas hai, jiski baaliyon mein daane hote hain! 🌾 Unhi daanon ko peeskar aata banta hai, jisse roti banti hai.
@sugar चीनी,शक्कर,sugar,chini,cheeni,shakkar + कहां से,$HOW,$WHERE,=from,बनती,=made,banti
h चीनी गन्ने के मीठे रस से बनती है! 🎋 पर ज़्यादा मीठा दाँतों को पसंद नहीं, इसलिए थोड़ा ही खाना।
e Sugar is made from the sweet juice of sugarcane! 🎋 But teeth don't like too much sweet, so just a little.
g Cheeni ganne ke meethe ras se banti hai! 🎋 Par zyada meetha daanton ko pasand nahi, isliye thoda hi khaana.
@sweets_limit मिठाई,टॉफी,चॉकलेट,कैंडी,मीठा,sweets,sweet,candy,candies,chocolate,chocolates,toffee,toffees,mithai,meetha + ज्यादा,क्यों नहीं,too much,too many,why not,zyada,jyada,kyun nahi,$WHY
h ज़्यादा मीठा खाने से दाँतों में कीटाणु पार्टी करते हैं और पेट भी थक जाता है! 🍬 थोड़ी-सी मिठाई कभी-कभी — और फिर ब्रश!
e Too many sweets let tooth germs have a party, and tummies get tired too! 🍬 A little sweet now and then — and then brush!
g Zyada meetha khaane se daanton mein keetanu party karte hain aur pet bhi thak jaata hai! 🍬 Thodi si mithai kabhi-kabhi — aur phir brush!
@onion_tears प्याज,onion,onions,pyaj,pyaaz + आंसू,आंख,रोना,रुलाता,tears,=cry,crying,eyes,aansu,=rona,rulata
h प्याज़ काटने पर उसमें से एक हल्की-सी गैस निकलती है, जो आँखों को चुभती है! 🧅 तब आँखें आँसू बनाकर खुद को धो लेती हैं।
e Cutting an onion lets out a tiny gas that tickles our eyes! 🧅 So our eyes make tears to wash it away.
g Pyaaz kaatne par usmein se ek halki si gas nikalti hai, jo aankhon ko chubhti hai! 🧅 Tab aankhein aansoo banakar khud ko dho leti hain.
@chilli मिर्च,तीखा,तीखी,chilli,chillies,chili,spicy,mirch,teekha,tikha,teekhi
h मिर्च में एक खास चीज़ होती है जो जीभ को गर्म-गर्म लगती है, इसलिए वो तीखी लगती है! 🌶️ दूध या दही से जीभ को जल्दी आराम मिलता है।
e Chillies have a special something that makes our tongue feel hot, so they taste spicy! 🌶️ Milk or curd soothes your tongue quickly.
g Mirch mein ek khaas cheez hoti hai jo jeebh ko garam-garam lagti hai, isliye woh teekhi lagti hai! 🌶️ Doodh ya dahi se jeebh ko jaldi aaraam milta hai.
@icecream आइसक्रीम,कुल्फी,ice cream,icecream,kulfi + ठंडी,ठंडा,cold,thandi,thanda,$WHY,$HOW,बनती,=made,banti
h आइसक्रीम दूध और मीठे को जमाकर बनती है, इसलिए वो ठंडी होती है! 🍦 उसे धीरे-धीरे खाओ, ताकि सिर में ठंडी झुनझुनी न हो।
e Ice cream is made by freezing milk and sugar, so it's cold! 🍦 Eat it slowly so you don't get a brain-freeze.
g Ice cream doodh aur meethe ko jamaakar banti hai, isliye woh thandi hoti hai! 🍦 Use dheere-dheere khao, taaki sir mein thandi jhunjhuni na ho.
@chew चबा,chew,chewing,chaba,chabana,chabake
h खाना अच्छे से चबाने पर पेट को उसे पचाना आसान होता है! 😋 हर कौर को धीरे-धीरे चबाओ, जैसे गाय चबाती है।
e Chewing food well makes it easier for your tummy to digest! 😋 Chew each bite slowly, like a cow does.
g Khaana achhe se chabaane par pet ko use pachaana aasaan hota hai! 😋 Har kaur ko dheere-dheere chabao, jaise gaay chabaati hai.
@wash_fruit $FRUIT,$VEG + धोकर,धोना,धोते,wash,washing,dhokar,dhona,dhote
h फलों और सब्ज़ियों पर मिट्टी और छोटे कीटाणु हो सकते हैं, इसलिए उन्हें धोकर खाते हैं! 🍎 बड़ों के साथ पानी में धोओ, फिर मज़े से खाओ।
e Fruits and vegetables can have dirt and tiny germs on them, so we wash them first! 🍎 Wash them with a grown-up, then enjoy.
g Phalon aur sabziyon par mitti aur chhote keetanu ho sakte hain, isliye unhe dhokar khaate hain! 🍎 Badon ke saath paani mein dhoo, phir maze se khao.
@leaves_fall पत्ते,पत्तियां,पत्ता,leaves,=leaf,patte,pattiyan,patta + गिरते,गिरती,झड,fall,falling,girte,girti,jhad
h कुछ पेड़ सर्दी या सूखे मौसम से पहले पुराने पत्ते गिरा देते हैं, ताकि आराम कर सकें! 🍂 फिर वसंत में नए हरे पत्ते आते हैं।
e Some trees drop their old leaves before the cold or dry season, so they can rest! 🍂 Then new green leaves come in spring.
g Kuch ped sardi ya sookhe mausam se pehle puraane patte gira dete hain, taaki aaraam kar sakein! 🍂 Phir vasant mein naye hare patte aate hain.
@sunflower सूरजमुखी,sunflower,sunflowers,surajmukhi
h सूरजमुखी का फूल बड़ा और पीला होता है, और छोटा पौधा सूरज की तरफ़ मुँह घुमाता है! 🌻 उसके बीज भी खाए जाते हैं।
e Sunflowers are big and yellow, and young sunflowers turn to face the sun! 🌻 Their seeds are yummy too.
g Surajmukhi ka phool bada aur peela hota hai, aur chhota paudha suraj ki taraf munh ghumata hai! 🌻 Uske beej bhi khaaye jaate hain.
@tomato ? टमाटर,tomato,tomatoes,tamatar
h टमाटर असल में एक फल है, क्योंकि उसके अंदर बीज होते हैं! 🍅 पर हम उसे सब्ज़ी की तरह पकाते हैं।
e A tomato is really a fruit, because it has seeds inside! 🍅 But we cook it like a vegetable.
g Tamatar asal mein ek phal hai, kyunki uske andar beej hote hain! 🍅 Par hum use sabzi ki tarah pakaate hain.
@mango ? =आम,आमों,mango,mangoes,aamras,aam ka,aam ki,aam ke,aamon
h आम को फलों का राजा कहते हैं, और वो गर्मियों में आता है! 🥭 आम हमारा राष्ट्रीय फल भी है।
e The mango is called the king of fruits, and it comes in summer! 🥭 It's India's national fruit too.
g Aam ko phalon ka raja kehte hain, aur woh garmiyon mein aata hai! 🥭 Aam hamara rashtriya phal bhi hai.
@banana ? केला,केले,banana,bananas,=kela,=kele
h केला गुच्छों में उगता है, और खाने से झटपट ताक़त देता है! 🍌 उसका छिलका कूड़ेदान में डालना, रास्ते पर नहीं।
e Bananas grow in bunches and give you quick energy! 🍌 Put the peel in the bin, never on the path.
g Kela guchchhon mein ugta hai, aur khaane se jhatpat taakat deta hai! 🍌 Uska chhilka koodedaan mein daalna, raaste par nahi.
@apple ? =सेब,apple,apples,=seb
h सेब पेड़ पर उगता है, और कश्मीर और हिमाचल जैसे ठंडे पहाड़ों में खूब होता है! 🍎 वो लाल, हरा या पीला होता है।
e Apples grow on trees, and lots grow in cool hilly places like Kashmir and Himachal! 🍎 They can be red, green or yellow.
g Seb ped par ugta hai, aur Kashmir aur Himachal jaise thande pahaadon mein khoob hota hai! 🍎 Woh laal, hara ya peela hota hai.
@orange_fruit ? संतरा,संतरे,oranges,santra,santre,=orange fruit
h संतरा रसीला और खट्टा-मीठा होता है, और उसमें विटामिन सी होता है! 🍊 नागपुर के संतरे बहुत मशहूर हैं।
e Oranges are juicy and sweet-sour, and full of vitamin C! 🍊 Nagpur in India is famous for its oranges.
g Santra raseela aur khatta-meetha hota hai, aur usmein vitamin C hota hai! 🍊 Nagpur ke santre bahut mashhoor hain.
@grapes ? अंगूर,grape,grapes,angur,angoor
h अंगूर बेल पर गुच्छों में उगते हैं! 🍇 सूखे अंगूर को किशमिश कहते हैं।
e Grapes grow in bunches on climbing vines! 🍇 Dried grapes are called raisins.
g Angoor bel par guchchhon mein ugte hain! 🍇 Sookhe angoor ko kishmish kehte hain.
@watermelon ? तरबूज,watermelon,watermelons,tarbooz,tarbuj
h तरबूज़ में बहुत सारा पानी होता है, इसलिए गर्मियों में वो ठंडक देता है! 🍉 बाहर से हरा, अंदर से लाल — कमाल है ना?
e Watermelon is full of water, so it's super refreshing in summer! 🍉 Green outside, red inside — amazing, right?
g Tarbooz mein bahut saara paani hota hai, isliye garmiyon mein woh thandak deta hai! 🍉 Bahar se hara, andar se laal — kamaal hai na?
@papaya ? पपीता,पपीते,papaya,papita
h पपीता पेट के लिए बहुत अच्छा फल है! 🧡 उसके अंदर छोटे-छोटे काले बीज होते हैं।
e Papaya is a fruit that's very good for your tummy! 🧡 It has lots of little black seeds inside.
g Papita pet ke liye bahut achha phal hai! 🧡 Uske andar chhote-chhote kaale beej hote hain.
@guava ? अमरूद,guava,guavas,amrud,amrood
h अमरूद में संतरे से भी ज़्यादा विटामिन सी होता है! 💚 और तोतों को अमरूद बहुत पसंद है — मुझे भी!
e Guavas have even more vitamin C than oranges! 💚 And parrots love guavas — me too!
g Amrood mein santre se bhi zyada vitamin C hota hai! 💚 Aur toton ko amrood bahut pasand hai — mujhe bhi!
@coconut ? नारियल,coconut,coconuts,nariyal,naariyal
h नारियल ऊँचे पेड़ों पर उगता है, और उसके अंदर मीठा पानी और सफ़ेद गिरी होती है! 🥥 केरल में और समुद्र किनारे नारियल के खूब पेड़ हैं।
e Coconuts grow on tall palm trees, with sweet water and white flesh inside! 🥥 Kerala and other seaside places have lots of coconut trees.
g Nariyal oonche pedon par ugta hai, aur uske andar meetha paani aur safed giri hoti hai! 🥥 Kerala mein aur samudra kinaare nariyal ke khoob ped hain.
@pomegranate ? अनार,pomegranate,pomegranates,=anar,anaar
h अनार के अंदर लाल-लाल मोती जैसे दाने होते हैं! ❤️ अ से अनार — याद है?
e A pomegranate is full of shiny red seeds, like little jewels! ❤️ Juicy and yummy.
g Anaar ke andar laal-laal moti jaise daane hote hain! ❤️ A se anaar — yaad hai?
@carrot ? गाजर,carrot,carrots,gajar,gaajar
h गाजर ज़मीन के अंदर उगती है — हम उसकी जड़ खाते हैं! 🥕 गाजर आँखों के लिए बहुत अच्छी होती है।
e Carrots grow under the ground — we eat the root! 🥕 Carrots are good for your eyes.
g Gaajar zameen ke andar ugti hai — hum uski jad khaate hain! 🥕 Gaajar aankhon ke liye bahut achhi hoti hai.
@spinach ? पालक,spinach,palak
h पालक हरी पत्तियों वाली सब्ज़ी है, जो शरीर को खूब ताक़त देती है! 🥬 पालक-पनीर, पालक-पराँठा — कितने मज़ेदार!
e Spinach is a leafy green vegetable that gives your body lots of strength! 🥬 Spinach with paneer, spinach paratha — so tasty!
g Palak hari pattiyon wali sabzi hai, jo shareer ko khoob taakat deti hai! 🥬 Palak-paneer, palak-paratha — kitne mazedaar!
@potato ? आलू,potato,potatoes,=aalu,=alu
h आलू ज़मीन के अंदर उगता है! 🥔 आलू से कितनी चीज़ें बनती हैं — पराँठा, सब्ज़ी, टिक्की!
e Potatoes grow under the ground! 🥔 They make so many yummy things — parathas, curries, tikkis!
g Aalu zameen ke andar ugta hai! 🥔 Aalu se kitni cheezein banti hain — paratha, sabzi, tikki!
@peas ? मटर,peas,=pea,matar
h मटर के दाने हरी फली के अंदर छिपे रहते हैं! 🫛 फली खोलकर दाने निकालना बड़ा मज़ेदार काम है।
e Peas hide inside green pods! 🫛 Popping the pods to get the peas out is so much fun.
g Matar ke daane hari phali ke andar chhipe rehte hain! 🫛 Phali kholkar daane nikaalna bada mazedaar kaam hai.
@pumpkin ? कद्दू,pumpkin,pumpkins,kaddu
h कद्दू बेल पर उगने वाली बड़ी-सी सब्ज़ी है! 🎃 कुछ कद्दू इतने बड़े होते हैं कि बच्चा उन पर बैठ जाए।
e Pumpkins are big vegetables that grow on vines! 🎃 Some get so big that a child could sit on one.
g Kaddu bel par ugne wali badi si sabzi hai! 🎃 Kuch kaddu itne bade hote hain ki bachcha un par baith jaaye.
@cucumber ? खीरा,खीरे,ककडी,cucumber,cucumbers,kheera,khira,kakdi
h खीरे में बहुत सारा पानी होता है, इसलिए वो ठंडा और ताज़ा लगता है! 🥒 गर्मियों में सलाद में खूब खाया जाता है।
e Cucumbers are full of water, so they feel cool and fresh! 🥒 Great in summer salads.
g Kheere mein bahut saara paani hota hai, isliye woh thanda aur taaza lagta hai! 🥒 Garmiyon mein salad mein khoob khaaya jaata hai.
@lemon ? नींबू,lemon,lemons,nimbu,neembu
h नींबू बहुत खट्टा होता है! 🍋 उसमें विटामिन सी होता है, और नींबू-पानी गर्मी में ताज़गी देता है।
e Lemons are super sour! 🍋 They have vitamin C, and lemonade is so refreshing in summer.
g Nimbu bahut khatta hota hai! 🍋 Usmein vitamin C hota hai, aur nimbu-paani garmi mein taazgi deta hai.
`);

  macro("TEETH", "दांत,दांतों,tooth,teeth,daant,=dant,daanton");
  macro("HAIR", "=बाल,बालों,hair,=baal,=bal,baalon");

  def("body", `
@sleep_why सोते,सोना,सोने,नींद,sleep,sleeping,=sona,sote,=sone,neend + $WHY,जरूरी,=need
h सोते समय हमारा शरीर आराम करता है और बढ़ता है! 😴 दिमाग भी दिन भर की बातें सँभालकर रखता है, इसलिए सुबह हम ताज़ा उठते हैं।
e While we sleep, our body rests and grows! 😴 Our brain tidies up everything we learned, so we wake up fresh.
g Sote samay hamara shareer aaraam karta hai aur badhta hai! 😴 Dimaag bhi din bhar ki baatein sambhaalkar rakhta hai, isliye subah hum taaza uthte hain.
@dreams सपना,सपने,ख्वाब,dream,dreams,dreaming,sapna,sapne + $WHY,$WHAT,$HOW,आते,=come,aate
h सपने तब आते हैं जब हम सोते हैं और हमारा दिमाग कहानियाँ बनाता है! 💭 सपने सच नहीं होते, बस दिमाग का खेल होते हैं।
e Dreams happen when we sleep and our brain makes up stories! 💭 Dreams aren't real — they're just our brain playing.
g Sapne tab aate hain jab hum sote hain aur hamara dimaag kahaniyan banaata hai! 💭 Sapne sach nahi hote, bas dimaag ka khel hote hain.
@brush_why ब्रश,दांत साफ,brush,brushing,daant saaf + $WHY,जरूरी
h ब्रश करने से दाँतों पर चिपके नन्हे कीटाणु भाग जाते हैं! 🪥 सुबह और रात को ब्रश करो, तो दाँत चमकते और मज़बूत रहते हैं।
e Brushing chases away the tiny germs stuck on our teeth! 🪥 Brush in the morning and at night to keep your teeth shiny and strong.
g Brush karne se daanton par chipke nanhe keetanu bhaag jaate hain! 🪥 Subah aur raat ko brush karo, toh daant chamakte aur mazboot rehte hain.
@bath_why नहा,नहाना,नहाते,स्नान,=bath,shower,bathe,naha,nahana,nahate,nahaana + $WHY,जरूरी
h नहाने से शरीर की धूल, पसीना और कीटाणु धुल जाते हैं! 🛁 नहाकर हम ताज़ा और खुश महसूस करते हैं।
e A bath washes away dust, sweat and germs! 🛁 After a bath we feel fresh and happy.
g Nahaane se shareer ki dhool, paseena aur keetanu dhul jaate hain! 🛁 Nahaakar hum taaza aur khush mehsoos karte hain.
@handwash हाथ धो,हाथ क्यों धो,साबुन,wash hands,wash my hands,wash our hands,washing hands,handwash,soap,haath dho,sabun,saabun + $WHY,जरूरी,$WHEN,$HOW
h हाथों पर ऐसे नन्हे कीटाणु होते हैं जो दिखते नहीं, और साबुन उन्हें भगा देता है! 🧼 खाने से पहले और टॉयलेट के बाद हाथ ज़रूर धोना।
e Our hands have tiny germs we can't see, and soap chases them away! 🧼 Always wash your hands before eating and after the toilet.
g Haathon par aise nanhe keetanu hote hain jo dikhte nahi, aur saabun unhe bhaga deta hai! 🧼 Khaane se pehle aur toilet ke baad haath zaroor dhona.
@germs कीटाणु,जीवाणु,=germ,germs,keetanu,kitanu,bacteria,virus,viruses
h कीटाणु इतने छोटे जीव हैं कि आँखों से दिखते ही नहीं! 🦠 कुछ हमें बीमार कर सकते हैं, इसलिए हम हाथ धोते हैं और साफ़ रहते हैं।
e Germs are living things so tiny we can't see them! 🦠 Some can make us sick, so we wash our hands and keep clean.
g Keetanu itne chhote jeev hain ki aankhon se dikhte hi nahi! 🦠 Kuch humein beemaar kar sakte hain, isliye hum haath dhote hain aur saaf rehte hain.
@heart ? =दिल,हृदय,धडकन,धडकता,heart,heartbeat,=dil,dhadkan,dhadakta,=hriday
h दिल एक मज़बूत पंप है, जो पूरे शरीर में ताक़त पहुँचाने के लिए धक-धक करता रहता है! ❤️ दौड़ने के बाद वो और तेज़ धड़कता है।
e Your heart is a strong pump that goes thump-thump to send energy all around your body! ❤️ After running, it beats even faster.
g Dil ek mazboot pump hai, jo poore shareer mein taakat pahunchaane ke liye dhak-dhak karta rehta hai! ❤️ Daudne ke baad woh aur tez dhadakta hai.
@sneeze छींक,sneeze,sneezes,sneezing,chheenk,chhink,chhik
h छींक नाक की सफ़ाई है — नाक में धूल जाए तो शरीर आ-छीं करके उसे बाहर निकाल देता है! 🤧 छींकते समय कोहनी से मुँह ढकना।
e A sneeze cleans your nose — when dust gets in, your body goes achoo to push it out! 🤧 Cover your mouth with your elbow when you sneeze.
g Chheenk naak ki safaai hai — naak mein dhool jaaye toh shareer aa-chheen karke use bahar nikaal deta hai! 🤧 Chheenkte samay kohni se munh dhakna.
@yawn जम्हाई,उबासी,yawn,yawns,yawning,jamhai,jamhaai,ubasi
h जम्हाई तब आती है जब शरीर थका होता है या उसे थोड़ा आराम चाहिए! 🥱 देखो, जम्हाई की बात करते-करते शायद तुम्हें भी आ जाए।
e We yawn when our body is tired or needs a little rest! 🥱 Just talking about yawning might make you yawn too.
g Jamhaai tab aati hai jab shareer thaka hota hai ya use thoda aaraam chahiye! 🥱 Dekho, jamhaai ki baat karte-karte shaayad tumhe bhi aa jaaye.
@hiccups हिचकी,hiccup,hiccups,hichki
h हिचकी तब आती है जब छाती के नीचे वाली साँस की मांसपेशी अचानक उछल जाती है! 😮 थोड़ा पानी धीरे-धीरे पीने से अक्सर हिचकी रुक जाती है।
e Hiccups happen when the breathing muscle under your chest suddenly jumps! 😮 Slowly sipping some water often helps.
g Hichki tab aati hai jab chhaati ke neeche wali saans ki maaspeshi achaanak uchhal jaati hai! 😮 Thoda paani dheere-dheere peene se aksar hichki ruk jaati hai.
@grow_tall लंबा,लंबी,लंबे,tall,taller,lamba,lambi + $HOW,$WHEN,होऊंगा,होऊंगी,हो जाऊंगा,हो जाऊंगी,=grow,=become,hounga,houngi
h तुम हर दिन थोड़ा-थोड़ा बढ़ रहे हो, खासकर सोते समय! 🌱 अच्छा खाना, खेलना और भरपूर नींद तुम्हें लंबा और मज़बूत बनाते हैं।
e You're growing a tiny bit every day — especially while you sleep! 🌱 Good food, playing and lots of sleep help you grow tall and strong.
g Tum har din thoda-thoda badh rahe ho, khaaskar sote samay! 🌱 Achha khaana, khelna aur bharpoor neend tumhe lamba aur mazboot banaate hain.
@tears आंसू,tears,=tear,aansu,ansu + $WHY,$WHAT,$HOW,आते,=come,aate
h आँसू आँखों को साफ़ और गीला रखते हैं! 💧 जब हम बहुत दुखी या बहुत खुश होते हैं, तब भी आँसू निकल आते हैं — ये बिल्कुल ठीक है।
e Tears keep our eyes clean and wet! 💧 They also come out when we feel very sad or even very happy — and that's okay.
g Aansoo aankhon ko saaf aur geela rakhte hain! 💧 Jab hum bahut dukhi ya bahut khush hote hain, tab bhi aansoo nikal aate hain — yeh bilkul theek hai.
@blink पलक,झपक,blink,blinks,blinking,eyelid,eyelids,jhapak,palkein
h पलक झपकाने से आँखें साफ़ और गीली रहती हैं, जैसे गाड़ी का वाइपर! 👀 हम एक मिनट में बहुत बार पलक झपकाते हैं।
e Blinking keeps your eyes clean and wet, like a car's wipers! 👀 We blink many times every minute.
g Palak jhapkaane se aankhein saaf aur geeli rehti hain, jaise gaadi ka wiper! 👀 Hum ek minute mein bahut baar palak jhapkaate hain.
@haircut $HAIR + कटवा,कटा,काट,=cut,haircut,cutting,katwa,kata,kaat
h बाल कटवाने में दर्द नहीं होता, क्योंकि बालों में महसूस करने वाली नसें नहीं होतीं! 💇 और वो फिर से उग आते हैं।
e Haircuts don't hurt, because hair has no feeling nerves! 💇 And it grows back again.
g Baal katwaane mein dard nahi hota, kyunki baalon mein mehsoos karne wali nasein nahi hoti! 💇 Aur woh phir se ug aate hain.
@hair_grow $HAIR + बढते,बढता,उगते,लंबे,=grow,grows,growing,badhte,ugte
h बाल सिर की त्वचा के अंदर से रोज़ थोड़ा-थोड़ा बढ़ते हैं! 💇 इसलिए कुछ हफ़्तों में फिर से कटवाने पड़ते हैं।
e Hair grows a tiny bit every day from under the skin on your head! 💇 That's why it needs a trim every few weeks.
g Baal sir ki tvacha ke andar se roz thoda-thoda badhte hain! 💇 Isliye kuch hafton mein phir se katwaane padte hain.
@nails नाखून,=nail,nails,nakhun,nakhoon,naakhun
h नाखून हमारी उँगलियों के सिरों को बचाते हैं और रोज़ थोड़ा बढ़ते हैं! 💅 उन्हें बड़ों से कटवाओ, और दाँतों से मत चबाओ।
e Nails protect the tips of our fingers and grow a little every day! 💅 Ask a grown-up to trim them, and don't bite them.
g Naakhun hamari ungliyon ke siron ko bachaate hain aur roz thoda badhte hain! 💅 Unhe badon se katwao, aur daanton se mat chabao.
@belly_button नाभि,टुंडी,belly button,navel,nabhi,naabhi,tundi
h नाभि वो जगह है, जहाँ से तुम माँ के पेट में रहते हुए खाना पाते थे! 🤰 अब वो बस एक प्यारा-सा निशान है।
e Your belly button is where you got food while you were growing inside your mother! 🤰 Now it's just a cute little mark.
g Naabhi woh jagah hai, jahan se tum maa ke pet mein rehte hue khaana paate the! 🤰 Ab woh bas ek pyaara sa nishaan hai.
@burp डकार,=burp,burps,burping,dakar,dakaar
h खाते-पीते जो हवा पेट में चली जाती है, वो डकार बनकर बाहर आती है! 😄 डकार के बाद माफ़ कीजिए कहना अच्छी आदत है।
e When we swallow air while eating or drinking, it comes back out as a burp! 😄 Saying excuse me after a burp is a nice habit.
g Khaate-peete jo hawa pet mein chali jaati hai, woh dakaar bankar bahar aati hai! 😄 Dakaar ke baad maaf kijiye kehna achhi aadat hai.
@breathe सांस,breathe,breathing,breath,saans,=sans + $WHY,$HOW,लेते,=lete - $PLANT,पत्ते,leaves
h साँस से हम हवा अंदर लेते हैं, जिससे शरीर को चलने की ताक़त मिलती है! 🌬️ चलो, एक गहरी साँस लो — फूल सूँघो, और मोमबत्ती बुझाओ!
e Breathing brings air into our body, and that air gives us energy! 🌬️ Let's take a deep breath — smell the flower, and blow out the candle!
g Saans se hum hawa andar lete hain, jisse shareer ko chalne ki taakat milti hai! 🌬️ Chalo, ek gehri saans lo — phool soongho, aur mombatti bujhao!
@hunger_why भूख,hungry,hunger,bhukh,bhookh + $WHY,$HOW,लगती,=lagti
h भूख पेट का संदेश है कि शरीर को ताक़त के लिए खाना चाहिए! 🍽️ भूख लगे तो किसी बड़े से कहो।
e Hunger is your tummy's message that your body needs food for energy! 🍽️ Tell a grown-up when you feel hungry.
g Bhookh pet ka sandesh hai ki shareer ko taakat ke liye khaana chahiye! 🍽️ Bhookh lage toh kisi bade se kaho.
@tummy_growl =पेट,tummy,stomach,belly + गुडगुड,आवाज,growl,growls,growling,rumble,rumbles,gudgud,=avaj,avaaz
h पेट खाली हो तो उसमें हवा और रस हिलते हैं और गुड़-गुड़ की आवाज़ आती है! 😄 ये पेट का कहना है — खाना कब मिलेगा?
e When your tummy is empty, air and juices move around and make a rumbling sound! 😄 It's your tummy asking, when is food coming?
g Pet khaali ho toh usmein hawa aur ras hilte hain aur gud-gud ki awaaz aati hai! 😄 Yeh pet ka kehna hai — khaana kab milega?
@food_journey खाना,food,khana,khaana + कहां जाता,where does,where do,कहां चला,=goes,kahan jata,kahan jaata,=go
h खाना मुँह से एक नली में होकर पेट में जाता है, जहाँ वो पिसकर शरीर की ताक़त बन जाता है! 🍛 जो काम का नहीं, वो टॉयलेट में बाहर निकल जाता है।
e Food goes down a tube into your tummy, where it gets mashed up and turned into energy! 🍛 What the body doesn't need comes out when you go to the toilet.
g Khaana munh se ek nali mein hokar pet mein jaata hai, jahan woh piskar shareer ki taakat ban jaata hai! 🍛 Jo kaam ka nahi, woh toilet mein bahar nikal jaata hai.
@toilet टॉयलेट,पॉटी,सूसू,शौच,toilet,potty,poop,poo,=pee,susu,=loo + $WHY,$HOW,$WHAT
h शरीर खाने से ताक़त ले लेता है, और जो बचता है उसे सूसू-पॉटी से बाहर निकाल देता है! 🚽 फिर हाथ साबुन से ज़रूर धोना।
e Our body keeps the good stuff from food and pushes out the rest as pee and poo! 🚽 Then always wash your hands with soap.
g Shareer khaane se taakat le leta hai, aur jo bachta hai use susu-potty se bahar nikaal deta hai! 🚽 Phir haath saabun se zaroor dhona.
@milk_teeth $TEETH,दूध के दांत,baby teeth,milk teeth + गिरते,गिरता,गिर,टूट,हिल,=fall,falls,falling,wobbly,loose,=gir,girte,toot,hil
h छोटे बच्चों के दूध के दाँत होते हैं, जो बड़े होने पर गिर जाते हैं! 🦷 उनकी जगह नए, मज़बूत दाँत आते हैं — ये बड़े होने की निशानी है।
e Children have baby teeth that fall out as they grow! 🦷 New, strong teeth come in their place — it's a sign you're growing up.
g Chhote bachchon ke doodh ke daant hote hain, jo bade hone par gir jaate hain! 🦷 Unki jagah naye, mazboot daant aate hain — yeh bade hone ki nishaani hai.
@skin_colour त्वचा,चमडी,skin,tvacha,chamdi + रंग,अलग,colour,colours,color,different,=rang,alag,shade
h हमारी त्वचा में एक रंग होता है, जो किसी में ज़्यादा और किसी में कम होता है! 🤎 इसलिए हम सब अलग-अलग रंग के हैं — और हर रंग सुंदर है।
e Our skin has a colour inside it — some people have more, some have less! 🤎 That's why we come in different shades, and every shade is beautiful.
g Hamari tvacha mein ek rang hota hai, jo kisi mein zyada aur kisi mein kam hota hai! 🤎 Isliye hum sab alag-alag rang ke hain — aur har rang sundar hai.
@bones हड्डी,हड्डियां,=bone,bones,haddi,haddiyan,skeleton,कंकाल
h हड्डियाँ हमारे शरीर का मज़बूत ढाँचा हैं, जिनसे हम खड़े होते और चलते हैं! 🦴 दूध, दाल और खेल-कूद से हड्डियाँ मज़बूत बनती हैं।
e Bones are the strong frame of our body that helps us stand and move! 🦴 Milk, dal and playing make bones strong.
g Haddiyan hamare shareer ka mazboot dhaancha hain, jinse hum khade hote aur chalte hain! 🦴 Doodh, daal aur khel-kood se haddiyan mazboot banti hain.
@goosebumps रोंगटे,goosebumps,goose bumps,rongte
h ठंड लगे या कुछ रोमांचक हो, तो त्वचा के छोटे बाल खड़े हो जाते हैं — इन्हें रोंगटे कहते हैं! 😲 ये शरीर का गर्म रहने का पुराना तरीका है।
e When we feel cold or excited, tiny hairs on our skin stand up — goosebumps! 😲 It's an old trick the body uses to stay warm.
g Thand lage ya kuch romaanchak ho, toh tvacha ke chhote baal khade ho jaate hain — inhe rongte kehte hain! 😲 Yeh shareer ka garam rehne ka puraana tareeka hai.
@shiver कांप,ठिठुर,shiver,shivering,shivers,kaanp,kanp,thithur
h ठंड में हम काँपते हैं, क्योंकि हिलती मांसपेशियाँ शरीर को गर्मी देती हैं! 🥶 तब स्वेटर पहनो और बड़ों को बताओ।
e We shiver in the cold because wiggling muscles make warmth! 🥶 Put on a sweater and tell a grown-up.
g Thand mein hum kaanpte hain, kyunki hilti maaspeshiyan shareer ko garmi deti hain! 🥶 Tab sweater pehno aur badon ko batao.
@sweat पसीना,पसीने,sweat,sweating,sweaty,pasina,paseena
h पसीना शरीर का कूलर है — वो त्वचा को ठंडा करता है! 💦 खेलने के बाद पानी पीना न भूलना।
e Sweat is your body's cooler — it cools down your skin! 💦 Don't forget to drink water after playing.
g Paseena shareer ka cooler hai — woh tvacha ko thanda karta hai! 💦 Khelne ke baad paani peena na bhoolna.
@tickle गुदगुदी,tickle,tickles,tickling,ticklish,gudgudi
h गुदगुदी में त्वचा की नसें हल्के छूने से चौंक जाती हैं, और हम हँस पड़ते हैं! 😆 मज़ेदार बात — हम खुद को गुदगुदी नहीं कर पाते।
e Tickles surprise the nerves in our skin, and we burst out laughing! 😆 Fun fact — we can't tickle ourselves.
g Gudgudi mein tvacha ki nasein halke chhoone se chaunk jaati hain, aur hum hans padte hain! 😆 Mazedaar baat — hum khud ko gudgudi nahi kar paate.
@eyes ? आंख,आंखें,आंखों,=eye,eyes,aankh,aankhen,aankhon,=ankh
h आँखों से हम दुनिया के रंग, शक्लें और रोशनी देखते हैं! 👀 दो आँखें मिलकर बताती हैं कि चीज़ें कितनी दूर हैं।
e Our eyes let us see colours, shapes and light! 👀 Two eyes together tell us how far away things are.
g Aankhon se hum duniya ke rang, shakalein aur roshni dekhte hain! 👀 Do aankhein milkar bataati hain ki cheezein kitni door hain.
@ears ? =कान,कानों,=ear,ears,=kaan,=kan,kaanon
h कानों से हम आवाज़ें सुनते हैं — गाना, चिड़ियों की चीं-चीं और घर वालों की बातें! 👂 कान के अंदर कभी कुछ मत डालना।
e Our ears help us hear — songs, birds chirping and our family's voices! 👂 Never put anything inside your ears.
g Kaanon se hum awaazein sunte hain — gaana, chidiyon ki cheen-cheen aur ghar walon ki baatein! 👂 Kaan ke andar kabhi kuch mat daalna.
@nose ? =नाक,nose,=naak,=nak
h नाक से हम साँस लेते हैं और खुशबू सूँघते हैं! 👃 नाक के अंदर के छोटे बाल धूल को अंदर जाने से रोकते हैं।
e We breathe and smell with our nose! 👃 Tiny hairs inside it stop dust from getting in.
g Naak se hum saans lete hain aur khushboo soonghte hain! 👃 Naak ke andar ke chhote baal dhool ko andar jaane se rokte hain.
@tongue ? जीभ,tongue,jeebh,jibh
h जीभ से हम मीठा, खट्टा, नमकीन और कड़वा स्वाद पहचानते हैं! 👅 जीभ बोलने में भी मदद करती है।
e Our tongue tastes sweet, sour, salty and bitter! 👅 It helps us talk too.
g Jeebh se hum meetha, khatta, namkeen aur kadwa swaad pehchaante hain! 👅 Jeebh bolne mein bhi madad karti hai.
@teeth ? $TEETH
h दाँतों से हम खाना काटते और चबाते हैं! 🦷 उन्हें रोज़ सुबह और रात ब्रश करके चमकाओ।
e Teeth help us bite and chew our food! 🦷 Brush them every morning and night to keep them shiny.
g Daanton se hum khaana kaatte aur chabaate hain! 🦷 Unhe roz subah aur raat brush karke chamkao.
@hands ? =हाथ,हाथों,=hand,hands,=haath,=hath,haathon
h हाथों से हम पकड़ते, लिखते, खाते, ताली बजाते और गले लगाते हैं! 🙌 दोनों हाथों में मिलाकर दस उँगलियाँ होती हैं।
e Our hands help us hold, write, eat, clap and hug! 🙌 Together they have ten fingers.
g Haathon se hum pakadte, likhte, khaate, taali bajaate aur gale lagaate hain! 🙌 Dono haathon mein milaakar das ungliyan hoti hain.
@feet ? =पैर,पैरों,=पांव,feet,=foot,=leg,legs,=pair,pairon,=paon
h पैरों से हम चलते, दौड़ते, कूदते और नाचते हैं! 🦶 पैरों में भी दस उँगलियाँ होती हैं — गिनकर देखो।
e Our feet and legs help us walk, run, jump and dance! 🦶 Our feet have ten toes too — count them.
g Pairon se hum chalte, daudte, koodte aur naachte hain! 🦶 Pairon mein bhi das ungliyan hoti hain — ginkar dekho.
@brain ? दिमाग,मस्तिष्क,brain,brains,dimag,dimaag,mastishk
h दिमाग हमारे सिर के अंदर का बॉस है — वो सोचता, याद रखता और पूरे शरीर को बताता है कि क्या करना है! 🧠 नई चीज़ें सीखने से दिमाग और तेज़ होता है।
e Your brain is the boss inside your head — it thinks, remembers and tells your whole body what to do! 🧠 Learning new things makes it even stronger.
g Dimaag hamare sir ke andar ka boss hai — woh sochta, yaad rakhta aur poore shareer ko bataata hai ki kya karna hai! 🧠 Nayi cheezein seekhne se dimaag aur tez hota hai.
@lungs ? फेफडे,फेफडा,lungs,=lung,phephde,fefde
h फेफड़े हमारी छाती में दो गुब्बारों जैसे हैं, जो साँस की हवा से फूलते और सिकुड़ते हैं! 🎈 हाथ छाती पर रखकर गहरी साँस लो — महसूस हुआ?
e Your lungs are like two balloons in your chest that fill up with air when you breathe! 🎈 Put a hand on your chest and take a deep breath — can you feel it?
g Phephde hamari chhaati mein do gubbaaron jaise hain, jo saans ki hawa se phoolte aur sikudte hain! 🎈 Haath chhaati par rakhkar gehri saans lo — mehsoos hua?
@tummy ? =पेट,stomach,tummy,belly
h पेट खाने को पीसकर शरीर के लिए ताक़त बनाता है! 🍲 वो थोड़ा-थोड़ा भरा हो तो सबसे खुश रहता है।
e Your tummy mashes up food and turns it into energy for your body! 🍲 It's happiest when it's not too full.
g Pet khaane ko peeskar shareer ke liye taakat banaata hai! 🍲 Woh thoda-thoda bhara ho toh sabse khush rehta hai.
@skin ? त्वचा,चमडी,=skin,tvacha,twacha
h त्वचा हमारे पूरे शरीर का कोट है — वो हमें धूल, कीटाणु और धूप से बचाती है! 🤚 छूकर गर्म-ठंडा भी वही बताती है।
e Skin is a coat for your whole body — it protects you from dust, germs and sun! 🤚 It also tells you if something is hot or cold.
g Tvacha hamare poore shareer ka coat hai — woh humein dhool, keetanu aur dhoop se bachaati hai! 🤚 Chhookar garam-thanda bhi wahi bataati hai.
@fingers उंगली,उंगलियां,अंगूठा,finger,fingers,thumb,ungli,ungliyan,angutha + $MANY,$WHY,$WHAT
h हमारे एक हाथ में पाँच उँगलियाँ होती हैं, और दोनों हाथों में दस! 🖐️ अँगूठे से हम चीज़ें मज़बूती से पकड़ पाते हैं।
e We have five fingers on each hand, and ten on both! 🖐️ Our thumbs help us hold things tightly.
g Hamare ek haath mein paanch ungliyan hoti hain, aur dono haathon mein das! 🖐️ Angoothe se hum cheezein mazbooti se pakad paate hain.
@exercise कसरत,व्यायाम,योग,exercise,yoga,kasrat,vyayam + $WHY,जरूरी,good
h कसरत और खेल से दिल, हड्डियाँ और मांसपेशियाँ मज़बूत होती हैं! 🤸 और मन भी खुश रहता है।
e Exercise and play make your heart, bones and muscles strong! 🤸 And they make you feel happy too.
g Kasrat aur khel se dil, haddiyan aur maaspeshiyan mazboot hoti hain! 🤸 Aur mann bhi khush rehta hai.
@dark_see अंधेरे,अंधेरा,=dark,andhere,andhera + देख,=see,dekh
h आँखों को देखने के लिए रोशनी चाहिए, और अँधेरे में रोशनी बहुत कम होती है! 🔦 थोड़ी देर में आँखें अँधेरे की थोड़ी आदी हो जाती हैं।
e Our eyes need light to see, and the dark has very little light! 🔦 After a while, our eyes get a little used to the dark.
g Aankhon ko dekhne ke liye roshni chahiye, aur andhere mein roshni bahut kam hoti hai! 🔦 Thodi der mein aankhein andhere ki thodi aadi ho jaati hain.
@tired_why थकते,थकान,थक जाते,tired,tiredness,thakte,thakaan,thak jate + $WHY
h बहुत खेलने के बाद शरीर की ताक़त कम हो जाती है, इसलिए हम थकते हैं! 😌 आराम और नींद से ताक़त फिर भर जाती है।
e After lots of play, our body's energy runs low, so we feel tired! 😌 Rest and sleep fill us up again.
g Bahut khelne ke baad shareer ki taakat kam ho jaati hai, isliye hum thakte hain! 😌 Aaraam aur neend se taakat phir bhar jaati hai.
@getting_old झुर्रियां,सफेद बाल,बूढे,बुजुर्ग,wrinkles,wrinkly,grey hair,gray hair,white hair,old people,jhurriyan,safed baal,budhe + $WHY,होते,=hote,=get
h जब लोग बहुत साल जी लेते हैं, तो त्वचा पर झुर्रियाँ आती हैं और बाल सफ़ेद हो जाते हैं! 👵 हर झुर्री में ढेर सारी कहानियाँ होती हैं — दादा-दादी से पूछना।
e When people have lived many years, their skin gets wrinkly and their hair turns white! 👵 Every wrinkle has lots of stories — ask your grandparents.
g Jab log bahut saal jee lete hain, toh tvacha par jhurriyan aati hain aur baal safed ho jaate hain! 👵 Har jhurri mein dher saari kahaniyan hoti hain — dada-dadi se poochhna.
`);

  macro("SCARED", "डर,डरा,डरी,डरता,डरती,डरते,scared,afraid,=fear,frightened,=dar,darr,dar lag,darta,darti");
  macro("FAMILY", "मम्मी,पापा,=मां,=माँ,माता,पिता,नानी,दादी,नाना,दादा,मौसी,चाचा,बुआ,परिवार,mummy,mumma,mom,mama,papa,dad,daddy,=maa,nani,dadi,nana,dada,mausi,chacha,bua,family,parivar,parivaar,parents");

  def("feelings", `
@feel_sad उदास,दुखी,मन खराब,मन भारी,sad,unhappy,upset,udaas,udas,dukhi,mann kharab
h उदास होना ठीक है, सबको कभी-कभी ऐसा लगता है। 💛 चलो, एक गहरी साँस लें और किसी बड़े से एक प्यारी-सी झप्पी माँगें।
e It's okay to feel sad — everyone does sometimes. 💛 Let's take a deep breath, and ask a grown-up for a big hug.
g Udaas hona theek hai, sabko kabhi-kabhi aisa lagta hai. 💛 Chalo, ek gehri saans lein aur kisi bade se ek pyaari si jhappi maangein.
h मैं तुम्हारे साथ हूँ। 💛 जो मन में है, वो किसी बड़े को बताओ — बात करने से मन हल्का होता है।
e I'm here with you. 💛 Tell a grown-up what's in your heart — talking makes it feel lighter.
g Main tumhare saath hoon. 💛 Jo mann mein hai, woh kisi bade ko batao — baat karne se mann halka hota hai.
@feel_angry गुस्सा,गुस्से,नाराज,angry,=mad,cross,gussa,naraz,naraaz
h गुस्सा आना ठीक है, पर किसी को चोट नहीं पहुँचाते। 💛 चलो, गुब्बारे वाली साँस — धीरे-धीरे फुलाओ, और धीरे-धीरे छोड़ो।
e It's okay to feel angry, but we never hurt anyone. 💛 Let's do balloon breathing — slowly blow up, and slowly let go.
g Gussa aana theek hai, par kisi ko chot nahi pahunchaate. 💛 Chalo, gubbaare wali saans — dheere-dheere phulao, aur dheere-dheere chhodo.
h जब गुस्सा आए, तो कछुए की तरह रुक जाओ और तीन तक गिनो। 🐢 फिर किसी बड़े को बताओ कि क्या हुआ।
e When you feel angry, stop like a turtle and count to three. 🐢 Then tell a grown-up what happened.
g Jab gussa aaye, toh kachhue ki tarah ruk jao aur teen tak gino. 🐢 Phir kisi bade ko batao ki kya hua.
@feel_scared $SCARED
h डर लगना ठीक है, बहादुर लोग भी डरते हैं। 💛 किसी बड़े के पास जाओ, उनका हाथ पकड़ो और धीरे-धीरे पाँच तक गिनो।
e It's okay to feel scared — even brave people do. 💛 Go to a grown-up, hold their hand and count slowly to five.
g Darr lagna theek hai, bahadur log bhi darte hain. 💛 Kisi bade ke paas jao, unka haath pakdo aur dheere-dheere paanch tak gino.
@scared_dark अंधेर,=dark,andhera,andhere + $SCARED
h अँधेरे में भी तुम्हारा कमरा वही रहता है, बस रोशनी सो जाती है। 🌙 एक छोटी लाइट जलाकर रखो और अपने खिलौने को झप्पी दो।
e In the dark, your room is just the same — only the light is sleeping. 🌙 A little night light and a cuddly toy can help.
g Andhere mein bhi tumhara kamra wahi rehta hai, bas roshni so jaati hai. 🌙 Ek chhoti light jalaakar rakho aur apne khilaune ko jhappi do.
@scared_thunder गरज,गडगड,बिजली,तूफान,thunder,lightning,storm,garaj,toofan,bijli + $SCARED
h गड़गड़ाहट बस बादलों की तेज़ आवाज़ है, घर के अंदर तुम सुरक्षित हो। ⛈️ किसी बड़े के पास बैठो और कान पर हाथ रखकर गिनती गिनो।
e Thunder is just a loud noise from the clouds — you're safe inside. ⛈️ Sit with a grown-up, cover your ears and count together.
g Gadgadahat bas baadalon ki tez awaaz hai, ghar ke andar tum surakshit ho. ⛈️ Kisi bade ke paas baitho aur kaan par haath rakhkar ginti gino.
@scared_dogs $DOG + $SCARED
h कुत्तों से डर लगे तो ये ठीक है। 🐶 कुत्ते के पास अकेले मत जाना, बड़ों के साथ रहना और छूने से पहले उसके मालिक से पूछना।
e It's okay to feel scared of dogs. 🐶 Don't go near a dog alone — stay with a grown-up, and ask the owner before touching.
g Kutton se darr lage toh yeh theek hai. 🐶 Kutte ke paas akele mat jaana, badon ke saath rehna aur chhoone se pehle uske maalik se poochhna.
@bad_dream बुरा सपना,बुरे सपने,डरावना सपना,nightmare,nightmares,bad dream,bad dreams,bura sapna,bure sapne,scary dream
h बुरा सपना सिर्फ़ सपना होता है, वो सच नहीं है। 💛 किसी बड़े को बताओ, थोड़ा पानी पियो, और कोई अच्छी बात सोचते हुए फिर से सो जाओ।
e A bad dream is only a dream — it isn't real. 💛 Tell a grown-up, have a sip of water, and think of something happy as you fall asleep again.
g Bura sapna sirf sapna hota hai, woh sach nahi hai. 💛 Kisi bade ko batao, thoda paani piyo, aur koi achhi baat sochte hue phir se so jao.
@ghosts भूत,राक्षस,चुडैल,ghost,ghosts,monster,monsters,bhoot,=bhut,rakshas,raakshas
h भूत और राक्षस सिर्फ़ कहानियों में होते हैं, असल में नहीं। 💛 डर लगे तो किसी बड़े को बताओ, वो तुम्हारे पास रहेंगे।
e Ghosts and monsters are only in stories, not in real life. 💛 If you feel scared, tell a grown-up — they'll stay with you.
g Bhoot aur raakshas sirf kahaniyon mein hote hain, asal mein nahi. 💛 Darr lage toh kisi bade ko batao, woh tumhare paas rahenge.
@feel_shy शर्म,शरमा,झिझक,शर्मीला,शर्मीली,=shy,nervous,sharam,sharma,jhijhak,sharmila,sharmili
h शर्म आना बिल्कुल ठीक है, बहुत लोग शर्मीले होते हैं। 🌸 बस एक मुस्कान से शुरुआत करो — दोस्ती अपने आप बढ़ेगी।
e It's perfectly okay to feel shy — lots of people do. 🌸 Start with just a smile, and friendship will grow by itself.
g Sharam aana bilkul theek hai, bahut log sharmile hote hain. 🌸 Bas ek muskaan se shuruaat karo — dosti apne aap badhegi.
@feel_jealous ईर्ष्या,जलन होती,jealous,jealousy,irshya,jalan hoti
h कभी-कभी दूसरों की चीज़ देखकर मन करता है कि वो हमारे पास भी हो, ये ठीक है। 💛 किसी बड़े को बताओ कि कैसा लग रहा है, और अपनी पसंद की किसी चीज़ के बारे में सोचो।
e Sometimes we wish we had what someone else has — that's okay. 💛 Tell a grown-up how you feel, and think of something you love.
g Kabhi-kabhi doosron ki cheez dekhkar mann karta hai ki woh hamare paas bhi ho, yeh theek hai. 💛 Kisi bade ko batao ki kaisa lag raha hai.
@feel_lonely अकेला,अकेली,अकेलापन,lonely,alone,akela,akeli,akelapan
h अकेलापन लगे, तो किसी बड़े के पास जाकर बैठो या उन्हें गले लगाओ। 💛 घर वाले और दोस्त साथ हों तो मन जल्दी खुश हो जाता है।
e If you feel lonely, go and sit with a grown-up or give them a hug. 💛 Family and friends make lonely feelings go away.
g Akelapan lage, toh kisi bade ke paas jaakar baitho ya unhe gale lagao. 💛 Ghar wale aur dost saath hon toh mann jaldi khush ho jaata hai.
@miss_someone याद आ,याद आती,याद आता,miss,missing,yaad aa,yaad aati,yaad aata + $FAMILY,दोस्त,friend,friends,=dost,teacher,टीचर
h किसी की याद आना दिखाता है कि तुम उनसे बहुत प्यार करते हो। 💛 उनके लिए एक चित्र बनाओ, और किसी बड़े से कहो कि उनसे बात करवा दें।
e Missing someone shows how much you love them. 💛 Draw a picture for them, and ask a grown-up if you can call them.
g Kisi ki yaad aana dikhaata hai ki tum unse bahut pyaar karte ho. 💛 Unke liye ek chitra banao, aur kisi bade se kaho ki unse baat karwa dein.
@nobody_plays कोई नहीं खेलता,कोई खेलता नहीं,खेलने नहीं देते,कोई दोस्त नहीं,nobody plays,no one plays,nobody wants to play,no friends,dont let me play,koi nahi khelta,koi dost nahi,khelne nahi dete
h ये सुनकर मुझे बुरा लगा, तुम्हारा मन दुखा होगा। 💛 किसी बड़े या टीचर को बताओ, और कल किसी एक बच्चे से पूछो — मेरे साथ खेलोगे?
e I'm sorry that happened — that must feel sad. 💛 Tell a grown-up or your teacher, and tomorrow try asking one child, will you play with me?
g Yeh sunkar mujhe bura laga, tumhara mann dukha hoga. 💛 Kisi bade ya teacher ko batao, aur kal kisi ek bachche se poochho — mere saath kheloge?
@toy_taken खिलौना,खिलौने,=toy,toys,khilauna,khilona,khilaune + छीन,ले लिया,ले गया,ले गई,नहीं देता,नहीं देती,took,snatched,grabbed,wont share,chheen,le liya,le gaya,nahi deta,nahi deti
h अपनी चीज़ छिन जाए तो बुरा लगता है, ये ठीक है। 💛 शांति से कहो — मेरी बारी है, वापस दो — और न माने तो किसी बड़े को बताओ।
e It feels bad when someone takes your toy. 💛 Calmly say, it's my turn, please give it back — and if they don't, tell a grown-up.
g Apni cheez chhin jaaye toh bura lagta hai, yeh theek hai. 💛 Shaanti se kaho — meri baari hai, waapas do — aur na maane toh kisi bade ko batao.
@lost_game हार गया,हार गई,हार गए,हारना,हार जाता,lost the game,i lost,we lost,haar gaya,haar gayi,haar gaye,haarna
h हारना भी खेल का हिस्सा है, अगली बार फिर कोशिश करेंगे! 💪 सबसे बड़ी बात — तुमने खेल खेला और मज़ा किया।
e Losing is part of every game — we'll try again next time! 💪 The best part is that you played and had fun.
g Haarna bhi khel ka hissa hai, agli baar phir koshish karenge! 💪 Sabse badi baat — tumne khel khela aur mazaa kiya.
@mistake गलती,गल्ती,गलतियां,mistake,mistakes,galti,galtiyan,oops
h गलती करना बिल्कुल ठीक है, गलतियों से ही हम सीखते हैं! 🌱 बोलो, अगली बार क्या अलग करोगे?
e Mistakes are totally okay — that's how we learn! 🌱 What will you try differently next time?
g Galti karna bilkul theek hai, galtiyon se hi hum seekhte hain! 🌱 Bolo, agli baar kya alag karoge?
@too_hard मुझसे नहीं होता,मुझसे नहीं हो रहा,नहीं कर पा,मुश्किल है,बहुत कठिन,i cant do,too hard,its hard,so hard,nahi kar pa,mujhse nahi hota,mushkil hai
h मुश्किल लगे तो छोटा-छोटा करके कोशिश करो — एक कदम, फिर दूसरा! 🐢 और मदद माँगना भी बहुत समझदारी है।
e When something feels hard, try it in tiny steps — one step, then the next! 🐢 Asking for help is smart too.
g Mushkil lage toh chhota-chhota karke koshish karo — ek kadam, phir doosra! 🐢 Aur madad maangna bhi bahut samajhdaari hai.
@feel_happy मैं खुश,मैं बहुत खुश,मुझे बहुत मजा,i am happy,im happy,i am so happy,i am excited,im excited,main khush,mai khush,main bahut khush,bahut maza aa
h वाह, तुम खुश हो तो मैं भी खुश! 🎉 बताओ, किस बात ने तुम्हें इतना खुश किया?
e Yay, if you're happy, I'm happy too! 🎉 Tell me, what made you so happy?
g Wah, tum khush ho toh main bhi khush! 🎉 Batao, kis baat ne tumhe itna khush kiya?
@sad_why दुखी,उदास,sad,dukhi,udaas,udas + $WHY,$HOW,होते,होता,=hote,=hota,=feel
h जब कुछ हमारी मर्ज़ी से नहीं होता या हम किसी को याद करते हैं, तो मन उदास होता है। 💛 ये भावना थोड़ी देर बाद चली जाती है, जैसे बादल।
e We feel sad when things don't go our way or when we miss someone. 💛 Sad feelings pass after a while, like clouds.
g Jab kuch hamari marzi se nahi hota ya hum kisi ko yaad karte hain, toh mann udaas hota hai. 💛 Yeh bhaavna thodi der baad chali jaati hai, jaise baadal.
@laugh_why हंसते,हंसी,हंसना,laugh,laughing,laughter,hanste,hansi,hansna,hasna + $WHY
h जब कुछ मज़ेदार या प्यारा होता है, तो हमारी खुशी हँसी बनकर बाहर आती है! 😄 साथ हँसने से दोस्ती भी बढ़ती है।
e When something is funny or lovely, our happy feeling bursts out as a laugh! 😄 Laughing together makes friendships stronger.
g Jab kuch mazedaar ya pyaara hota hai, toh hamari khushi hansi bankar bahar aati hai! 😄 Saath hansne se dosti bhi badhti hai.
@cry_ok रोना,रोते,रो सकते,=cry,crying,=rona,rote + ठीक,=okay,=ok,बुरा,=bad,theek,thik
h हाँ, रोना बिल्कुल ठीक है — बड़े भी रोते हैं! 💛 रोने के बाद मन हल्का हो जाता है, और किसी बड़े की झप्पी और भी मदद करती है।
e Yes, crying is totally okay — grown-ups cry too! 💛 Crying helps our feelings come out, and a hug from a grown-up helps even more.
g Haan, rona bilkul theek hai — bade bhi rote hain! 💛 Rone ke baad mann halka ho jaata hai, aur kisi bade ki jhappi aur bhi madad karti hai.
@first_day पहला दिन,पहले दिन,नया स्कूल,नई क्लास,first day,new school,new class,pehla din,pehle din,naya school
h नई जगह पर पहले दिन थोड़ा घबराना ठीक है। 🎒 टीचर को नमस्ते कहो, एक दोस्त ढूँढो — छुट्टी के बाद तुम फिर घर वालों से मिलोगे।
e Feeling a bit nervous on the first day is okay. 🎒 Say hello to your teacher and find one friend — after school you'll see your family again.
g Nayi jagah par pehle din thoda ghabraana theek hai. 🎒 Teacher ko namaste kaho, ek dost dhoondho — chhutti ke baad tum phir ghar walon se miloge.
@calm_down शांत,calm,calm down,=shant,shaant,relax + $HOW,होऊं,=hou,=become
h चलो, पेट पर हाथ रखकर धीरे-धीरे साँस लो — चार तक अंदर, चार तक बाहर। 🌬️ फिर अपने आसपास की पाँच चीज़ें ढूँढो।
e Put your hand on your tummy and breathe slowly — in for four, out for four. 🌬️ Then find five things you can see around you.
g Chalo, pet par haath rakhkar dheere-dheere saans lo — chaar tak andar, chaar tak bahar. 🌬️ Phir apne aas-paas ki paanch cheezein dhoondho.
@feelings_what भावना,भावनाएं,feelings,feeling,emotions,emotion,bhavna,bhaavna,bhavnaye + $WHAT,$TELL,$WHY
h भावनाएँ मन के मौसम जैसी हैं — कभी खुशी की धूप, कभी उदासी के बादल! 🌦️ सब भावनाएँ ठीक हैं, और वो बदलती रहती हैं।
e Feelings are like weather inside us — sometimes happy sunshine, sometimes sad clouds! 🌦️ All feelings are okay, and they change.
g Bhaavnaayein mann ke mausam jaisi hain — kabhi khushi ki dhoop, kabhi udaasi ke baadal! 🌦️ Sab bhaavnaayein theek hain, aur woh badalti rehti hain.
`);

  def("family", `
@share_why बांटना,बांटते,बांट,शेयर,share,sharing,baantna,baant,=bant + $WHY,$HOW,जरूरी,should
h बाँटने से खेल में दोगुना मज़ा आता है, और दोस्ती पक्की होती है! 🤝 पहले तुम, फिर मैं — बारी-बारी खेलना कमाल है।
e Sharing makes playing twice as fun, and friendships stronger! 🤝 You first, then me — taking turns is great.
g Baantne se khel mein doguna mazaa aata hai, aur dosti pakki hoti hai! 🤝 Pehle tum, phir main — baari-baari khelna kamaal hai.
@make_friends =दोस्त,दोस्ती,friend,friends,=dost,dosti + बनाऊं,बनाते,बनाना,बनाएं,=make,banau,banaun,banate,banana,$HOW
h दोस्त बनाने के लिए मुस्कुराओ, हैलो कहो और पूछो — मेरे साथ खेलोगे? 😊 फिर अपने खिलौने बाँटो।
e To make a friend, smile, say hello and ask, want to play with me? 😊 Then share your toys.
g Dost banaane ke liye muskurao, hello kaho aur poochho — mere saath kheloge? 😊 Phir apne khilaune baanto.
@sorry_why सॉरी,सारी,माफी,=sorry,maafi,mafi,apologise,apologize + $WHY,$HOW,$WHEN,कहते,=say,kehte
h सॉरी कहने से दूसरे का दुखा हुआ मन ठीक होता है, और दोस्ती फिर से जुड़ जाती है! 💛 सॉरी कहना बहादुरी का काम है।
e Saying sorry helps a hurt heart feel better, and fixes friendships! 💛 Saying sorry is a brave thing to do.
g Sorry kehne se doosre ka dukha hua mann theek hota hai, aur dosti phir se jud jaati hai! 💛 Sorry kehna bahaduri ka kaam hai.
@magic_words धन्यवाद,शुक्रिया,प्लीज,कृपया,thank you,thanks,please,dhanyavad,dhanyavaad,shukriya,kripya + $WHY,कहते,=say,kehte
h प्लीज़ और धन्यवाद जादुई शब्द हैं — इनसे सबका मन खुश हो जाता है! ✨ आज तुम किसको धन्यवाद कहोगे?
e Please and thank you are magic words — they make everyone feel happy! ✨ Who will you thank today?
g Please aur dhanyavaad jaadui shabd hain — inse sabka mann khush ho jaata hai! ✨ Aaj tum kisko dhanyavaad kahoge?
@grandparents दादा,दादी,नाना,नानी,grandma,grandpa,grandparents,granny,grandmother,grandfather,=dada,=dadi,=nana,=nani + बूढे,=old,$WHY,$WHAT,$WHO
h दादा-दादी और नाना-नानी हमारे मम्मी-पापा के मम्मी-पापा हैं! 👵 उन्होंने बहुत साल जिए हैं, इसलिए उनके पास ढेर सारी कहानियाँ हैं।
e Grandparents are your parents' own mummy and papa! 👵 They've lived many years, so they know lots of stories.
g Dada-dadi aur nana-nani hamare Mummy-Papa ke Mummy-Papa hain! 👵 Unhone bahut saal jiye hain, isliye unke paas dher saari kahaniyan hain.
@parents_work ? $FAMILY + ऑफिस,काम पर,दफ्तर,office,work,=job,kaam par,daftar
h बड़े काम करते हैं ताकि घर के लिए खाना, कपड़े और ज़रूरी चीज़ें आ सकें, और वो दूसरों की मदद भी करते हैं! 💼 काम के बाद फिर साथ में खेलने का समय आता है।
e Grown-ups work so the family has food, clothes and everything they need, and to help other people too! 💼 After work, it's time to be together again.
g Bade kaam karte hain taaki ghar ke liye khaana, kapde aur zaroori cheezein aa sakein, aur woh doosron ki madad bhi karte hain! 💼 Kaam ke baad phir saath mein khelne ka samay aata hai.
@babies_from ! $BABY,बेबी + कहां से,कैसे आते,कैसे आता,कैसे होते,कैसे होता,कैसे बनते,पैदा,where,come from,comes from,made,born,kahan se,kaise aate,kaise hote,paida - $ANIMALNAMES,$ANIMAL
h छोटा बच्चा माँ के पेट में एक खास जगह पर धीरे-धीरे बढ़ता है, और तैयार होने पर दुनिया में आता है! 👶 बाकी बातें तुम्हें घर के बड़े अच्छे से बताएँगे — उनसे पूछना।
e A baby grows slowly in a special place inside the mother's tummy, and comes out when it's ready! 👶 Ask a grown-up at home — they can tell you more.
g Chhota bachcha maa ke pet mein ek khaas jagah par dheere-dheere badhta hai, aur taiyaar hone par duniya mein aata hai! 👶 Baaki baatein tumhe ghar ke bade achhe se batayenge — unse poochhna.
@new_sibling छोटा भाई,छोटी बहन,नया भाई,नई बहन,नन्हा भाई,new baby,baby brother,baby sister,chhota bhai,chhoti behen,naya bhai,nayi behen
h घर में नया छोटा भाई या बहन आए, तो तुम बड़े भैया-दीदी बन जाते हो! 👶 तुम उसे गाना सुना सकते हो — और घर वालों का प्यार तुम्हारे लिए भी उतना ही है।
e When a new baby brother or sister arrives, you become the big brother or sister! 👶 You can sing them songs — and your family loves you just as much.
g Ghar mein naya chhota bhai ya behen aaye, toh tum bade bhaiya-didi ban jaate ho! 👶 Tum use gaana suna sakte ho — aur ghar walon ka pyaar tumhare liye bhi utna hi hai.
@sibling_fight भाई,बहन,भैया,दीदी,brother,sister,=bhai,behen,bhaiya,didi + लडाई,झगडा,लडते,झगडते,fight,fighting,fights,argue,ladai,jhagda,ladte,jhagadte
h भाई-बहन में कभी-कभी झगड़ा होना आम बात है। 🤝 गहरी साँस लो, अपनी बात आराम से कहो, और ज़रूरत हो तो किसी बड़े को बुलाओ।
e Brothers and sisters sometimes argue — that's normal. 🤝 Take a deep breath, say how you feel calmly, and call a grown-up if you need help.
g Bhai-behen mein kabhi-kabhi jhagda hona aam baat hai. 🤝 Gehri saans lo, apni baat aaraam se kaho, aur zaroorat ho toh kisi bade ko bulao.
@family_what परिवार,फैमिली,family,families,parivar,parivaar + $WHAT,$TELL,$WHY
h परिवार वो लोग हैं जो एक-दूसरे से प्यार करते हैं और एक-दूसरे का ध्यान रखते हैं! 🏡 हर परिवार अलग होता है — छोटा, बड़ा, सब प्यारे।
e A family is people who love each other and take care of each other! 🏡 Every family is different — small or big, all are special.
g Parivaar woh log hain jo ek-doosre se pyaar karte hain aur ek-doosre ka dhyan rakhte hain! 🏡 Har parivaar alag hota hai — chhota, bada, sab pyaare.
@help_home घर में मदद,घर का काम,घर के काम,help at home,chores,ghar mein madad,ghar ka kaam + $WHY,$HOW,$WHAT
h घर में मदद करने से सबका काम हल्का होता है, और तुम सुपर-हेल्पर बन जाते हो! 🦸 खिलौने समेटना, पौधों को पानी देना — ये भी बड़ी मदद है।
e Helping at home makes everyone's work lighter, and you become a super helper! 🦸 Putting toys away and watering plants are big help too.
g Ghar mein madad karne se sabka kaam halka hota hai, aur tum super-helper ban jaate ho! 🦸 Khilaune sametna, paudhon ko paani dena — yeh bhi badi madad hai.
@respect_elders आदर,इज्जत,सम्मान,respect,aadar,izzat,samman + $WHY,$HOW
h बड़ों का आदर करने से उन्हें अच्छा लगता है, और वो हमें प्यार से नई बातें सिखाते हैं! 🙏 नमस्ते कहना और ध्यान से सुनना — यही आदर है।
e Respecting elders makes them feel cared for, and they lovingly teach us new things! 🙏 Saying namaste and listening carefully is respect.
g Badon ka aadar karne se unhe achha lagta hai, aur woh humein pyaar se nayi baatein sikhaate hain! 🙏 Namaste kehna aur dhyan se sunna — yahi aadar hai.
@best_friend सबसे अच्छा दोस्त,पक्का दोस्त,best friend,pakka dost,sabse achha dost + $WHAT,$WHO,$TELL,$HOW
h पक्का दोस्त वो है जिसके साथ खेलकर मज़ा आए, जो बाँटे और मुश्किल में साथ दे! 🤗 तुम भी किसी के पक्के दोस्त बन सकते हो।
e A best friend is someone fun to play with, who shares and helps when things are hard! 🤗 You can be a best friend too.
g Pakka dost woh hai jiske saath khelkar mazaa aaye, jo baante aur mushkil mein saath de! 🤗 Tum bhi kisi ke pakke dost ban sakte ho.
@friend_moved =दोस्त,friend,=dost + चला गया,चली गई,दूसरे शहर,moved,moving away,shifted,chala gaya,chali gayi,doosre shehar
h दोस्त दूर चला जाए तो उसकी याद आना स्वाभाविक है। 💛 बड़ों की मदद से उसे चित्र भेजो या वीडियो कॉल करो — दोस्ती दूर से भी चलती है।
e It's natural to miss a friend who moved away. 💛 With a grown-up's help, send them a drawing or have a video call — friendships work from far away too.
g Dost door chala jaaye toh uski yaad aana swaabhaavik hai. 💛 Badon ki madad se use chitra bhejo ya video call karo — dosti door se bhi chalti hai.
@take_turns =बारी,बारी बारी,इंतजार,=turn,turns,=wait,waiting,=baari,=bari,baari baari,intezaar,intazar + $WHY
h बारी-बारी से खेलने में सबको मौका मिलता है, और कोई उदास नहीं होता! ⏳ इंतज़ार करते समय गिनती गिनो — समय जल्दी कटेगा।
e Taking turns means everyone gets a chance, and no one feels left out! ⏳ Count while you wait — time goes faster.
g Baari-baari se khelne mein sabko mauka milta hai, aur koi udaas nahi hota! ⏳ Intezaar karte samay ginti gino — samay jaldi katega.
@wedding शादी,विवाह,wedding,weddings,shaadi,shadi,vivah + $WHY,$WHAT,$TELL
h शादी एक बड़ा उत्सव है, जब दो लोग परिवार बनकर साथ रहने का वादा करते हैं! 🎊 उसमें नाच-गाना और स्वादिष्ट खाना होता है।
e A wedding is a big celebration where two people promise to be a family together! 🎊 There's music, dancing and yummy food.
g Shaadi ek bada utsav hai, jab do log parivaar bankar saath rehne ka vaada karte hain! 🎊 Usmein naach-gaana aur swaadisht khaana hota hai.
@kindness दयालु,=दया,अच्छा इंसान,kind,kindness,nice person,dayalu,=daya + $HOW,$WHAT,$WHY
h दयालु होना मतलब दूसरों की मदद करना, प्यार से बोलना और किसी को अकेला न छोड़ना! 🌈 आज तुम कौन सा दयालु काम करोगे?
e Being kind means helping others, speaking gently and never leaving anyone out! 🌈 What kind thing will you do today?
g Dayalu hona matlab doosron ki madad karna, pyaar se bolna aur kisi ko akela na chhodna! 🌈 Aaj tum kaun sa dayalu kaam karoge?
@truth झूठ,सच,lie,lies,lying,=truth,jhooth,jhuth,=sach + $WHY,$WHAT,बुरा,=bad,बोलना,=bolna,=tell
h सच बोलने से सब हम पर भरोसा करते हैं! 🌟 गलती हो जाए तो सच बता दो — सच बोलना बहादुरी है।
e Telling the truth helps everyone trust us! 🌟 If you make a mistake, tell the truth — that's brave.
g Sach bolne se sab hum par bharosa karte hain! 🌟 Galti ho jaaye toh sach bata do — sach bolna bahaduri hai.
@bad_words ! गाली,गालियां,गंदे शब्द,गंदी बात,बुरे शब्द,bad words,bad word,swear word,swear words,gande shabd,gandi baat
h कुछ शब्द दूसरों का मन दुखाते हैं, इसलिए हम उन्हें नहीं बोलते। 💛 कोई ऐसा शब्द सुना हो तो किसी बड़े से पूछना, वो समझाएँगे।
e Some words hurt people's feelings, so we don't use them. 💛 If you heard a word like that, ask a grown-up — they'll explain.
g Kuch shabd doosron ka mann dukhaate hain, isliye hum unhe nahi bolte. 💛 Koi aisa shabd suna ho toh kisi bade se poochhna, woh samjhaayenge.
@disability व्हीलचेयर,देख नहीं सकते,सुन नहीं सकते,चल नहीं सकते,wheelchair,=blind,=deaf,cant walk,cant see,cant hear,dekh nahi sakte,sun nahi sakte,chal nahi sakte,sign language
h कुछ लोगों का शरीर अलग तरह से काम करता है, इसलिए वो व्हीलचेयर, छड़ी या इशारों की भाषा का इस्तेमाल करते हैं! 🦽 हर कोई अपने तरीके से खास है, और हम सबसे प्यार से मिलते हैं।
e Some people's bodies work in different ways, so they may use a wheelchair, a cane or sign language! 🦽 Everyone is special in their own way, and we're kind to everyone.
g Kuch logon ka shareer alag tarah se kaam karta hai, isliye woh wheelchair, chhadi ya ishaaron ki bhasha ka istemaal karte hain! 🦽 Har koi apne tareeke se khaas hai, aur hum sabse pyaar se milte hain.
@bodies_differ मोटा,मोटी,मोटे,पतला,पतली,=fat,chubby,skinny,=mota,=moti,patla,patli + $WHY,$Q,कोई,लोग,people,someone,=he,=she,=vo,=wo,=वो
h हर शरीर अलग होता है — कोई लंबा, कोई छोटा, कोई पतला, कोई भरा-भरा — और सब अच्छे हैं! 🌈 किसी के शरीर पर मज़ाक नहीं बनाते।
e Every body is different — tall, short, thin or round — and every body is good! 🌈 We never make fun of anyone's body.
g Har shareer alag hota hai — koi lamba, koi chhota, koi patla, koi bhara-bhara — aur sab achhe hain! 🌈 Kisi ke shareer par mazaak nahi banaate.
@poor_people गरीब,गरीबी,=poor,poverty,gareeb,garib + $WHY,$WHAT
h कुछ लोगों के पास कम पैसे और कम चीज़ें होती हैं, और ये उनकी गलती नहीं है। 💛 हम अपनी चीज़ें बाँटकर और प्यार से बात करके मदद कर सकते हैं।
e Some people have less money and fewer things, and it isn't their fault. 💛 We can help by sharing and being kind.
g Kuch logon ke paas kam paise aur kam cheezein hoti hain, aur yeh unki galti nahi hai. 💛 Hum apni cheezein baantkar aur pyaar se baat karke madad kar sakte hain.
`);

  macro("YOU", "तुम,आप,तू,मिट्ठू,मिठ्ठू,=you,=u,=tum,=aap,=tu,mitthu,mithu,mittu");
  macro("DIED", "मर गया,मर गई,मर गए,मर गयी,गुजर गए,गुजर गई,गुजर गया,died,=dead,passed away,mar gaya,mar gayi,mar gaye,guzar gaye,gujar gaye");

  def("safety", `
@fire_hot =आग,=fire,=aag,=ag + =छू,छूना,छूते,छुएं,=touch,खेल,=play,$WHY,chhoo,chhuna,khel,गर्म,=hot
h आग बहुत गर्म होती है और जला सकती है, इसलिए उसे कभी नहीं छूते। 🔥 आग, माचिस और लाइटर सिर्फ़ बड़ों के काम की चीज़ें हैं।
e Fire is very hot and can burn, so we never touch it. 🔥 Fire, matches and lighters are only for grown-ups.
g Aag bahut garam hoti hai aur jala sakti hai, isliye use kabhi nahi chhoote. 🔥 Aag, maachis aur lighter sirf badon ke kaam ki cheezein hain.
@fire_now ! =आग,=fire,=aag + लगी,लग गई,जल रहा,जल रही,burning,on fire,lag gayi,lagi,jal raha,jal rahi
h जल्दी से किसी बड़े को ज़ोर से बुलाओ और उनके साथ बाहर चलो! 🚒 आग से दूर रहना — बड़े 112 पर फ़ोन करेंगे।
e Quickly shout for a grown-up and go outside with them! 🚒 Stay away from the fire — grown-ups will call 112.
g Jaldi se kisi bade ko zor se bulao aur unke saath bahar chalo! 🚒 Aag se door rehna — bade 112 par phone karenge.
@stove चूल्हा,चूल्हे,गैस,स्टोव,ओवन,stove,=gas,chulha,oven + =छू,छूना,=touch,$WHY,$YN,chhoo,chhuna
h चूल्हा और गैस बहुत गर्म होते हैं, इसलिए रसोई में खाना सिर्फ़ बड़े बनाते हैं। 🍳 तुम दूर से देखो, या बड़ों के साथ सब्ज़ियाँ धोने में मदद करो।
e Stoves get very hot, so only grown-ups do the cooking. 🍳 You can watch from a distance, or help a grown-up wash the vegetables.
g Chulha aur gas bahut garam hote hain, isliye rasoi mein khaana sirf bade banaate hain. 🍳 Tum door se dekho, ya badon ke saath sabziyan dhone mein madad karo.
@sockets सॉकेट,प्लग,बिजली का बोर्ड,बिजली के तार,=तार,socket,sockets,=plug,plugs,switchboard,=wire,wires,=current,करंट + =छू,छूना,=touch,उंगली,=finger,$WHY,$YN,chhoo,डाल,=put
h बिजली के सॉकेट और तारों में तेज़ करंट होता है, उन्हें कभी नहीं छूना। ⚡ प्लग लगाना-निकालना बड़ों का काम है।
e Sockets and wires have strong electricity inside — never touch them. ⚡ Plugging things in is a job for grown-ups.
g Bijli ke socket aur taaron mein tez current hota hai, unhe kabhi nahi chhoona. ⚡ Plug lagaana-nikaalna badon ka kaam hai.
@road_cross सडक,रोड,=road,street,sadak,sadkon + =पार,पार करना,पार करते,cross,crossing,paar karna,paar karte,=paar
h सड़क हमेशा किसी बड़े का हाथ पकड़कर पार करते हैं! 🚦 पहले रुको, दाएँ-बाएँ देखो, और बड़ों के साथ ही चलो।
e Always cross the road holding a grown-up's hand! 🚦 Stop, look both ways, and walk only with your grown-up.
g Sadak hamesha kisi bade ka haath pakadkar paar karte hain! 🚦 Pehle ruko, daayein-baayein dekho, aur badon ke saath hi chalo.
@traffic_light ट्रैफिक लाइट,ट्रैफिक सिग्नल,लाल बत्ती,हरी बत्ती,traffic light,traffic lights,traffic signal,=signal,lal batti,laal batti
h लाल बत्ती मतलब रुको, पीली मतलब तैयार हो जाओ, और हरी मतलब चलो! 🚦 सड़क पर हमेशा बड़ों के साथ रहना।
e Red means stop, yellow means get ready, and green means go! 🚦 Always stay with a grown-up near the road.
g Laal batti matlab ruko, peeli matlab taiyaar ho jao, aur hari matlab chalo! 🚦 Sadak par hamesha badon ke saath rehna.
@seatbelt सीट बेल्ट,सीटबेल्ट,seat belt,seatbelt,car seat
h सीट बेल्ट गाड़ी में हमें सीट से पक्का पकड़े रखती है, ताकि अचानक ब्रेक लगे तो हम सुरक्षित रहें! 🚗 गाड़ी चलने से पहले क्लिक!
e A seat belt holds us safely in our seat if the car stops suddenly! 🚗 Click it before the car moves!
g Seat belt gaadi mein humein seat se pakka pakde rakhti hai, taaki achaanak brake lage toh hum surakshit rahein! 🚗 Gaadi chalne se pehle click!
@helmet हेलमेट,helmet,helmets
h हेलमेट सिर की मज़बूत टोपी है, जो साइकिल या स्कूटर पर सिर को बचाती है! 🪖 सवारी से पहले हेलमेट ज़रूर पहनना।
e A helmet is a strong hat that protects your head on a bike or scooter! 🪖 Always wear one before you ride.
g Helmet sir ki mazboot topi hai, jo cycle ya scooter par sir ko bachaati hai! 🪖 Sawaari se pehle helmet zaroor pehenna.
@medicine ! दवा,दवाई,गोली,गोलियां,सिरप,medicine,medicines,tablet,tablets,pill,pills,syrup,dawai,dawa,=goli,goliyan + =खा,खाऊं,खा लूं,खा सकता,खा सकती,=eat,=take,$WHY,$YN,kha lu,khaun,=kha
h दवाई सिर्फ़ बड़े ही देते हैं, खुद से कभी नहीं लेना। 💊 कोई गोली टॉफ़ी जैसी दिखे, तब भी पहले किसी बड़े को दिखाना।
e Only grown-ups give medicine — never take it by yourself. 💊 Even if a pill looks like a sweet, show it to a grown-up first.
g Dawai sirf bade hi dete hain, khud se kabhi nahi lena. 💊 Koi goli toffee jaisi dikhe, tab bhi pehle kisi bade ko dikhaana.
@sharp_things चाकू,कैंची,ब्लेड,नुकीली,knife,knives,scissors,blade,=sharp,chaku,chaaku,kainchi
h चाकू और नुकीली चीज़ें बहुत तेज़ होती हैं, उन्हें सिर्फ़ बड़े इस्तेमाल करते हैं। ✂️ बच्चों के लिए गोल सिरे वाली कैंची होती है — वो भी बड़ों के साथ।
e Knives and sharp things are only for grown-ups. ✂️ Children can use round-tipped scissors — with a grown-up nearby.
g Chaaku aur nukeeli cheezein bahut tez hoti hain, unhe sirf bade istemaal karte hain. ✂️ Bachchon ke liye gol sire wali kainchi hoti hai — woh bhi badon ke saath.
@water_safety तालाब,स्विमिंग,=पूल,कुआं,तैरना,तैरने,swimming,=pool,=pond,=swim,talab,taalaab,kuan,tairna,tairne + $Q,जाऊं,जा सकता,जा सकती,can i,=go
h तालाब, नदी या पूल जैसे पानी के पास हमेशा किसी बड़े के साथ ही जाना! 🏊 तैरना भी बड़ों और सिखाने वालों के साथ सीखते हैं।
e Always go near water, like ponds, rivers or pools, with a grown-up! 🏊 We learn to swim with grown-ups and teachers too.
g Taalaab, nadi ya pool jaise paani ke paas hamesha kisi bade ke saath hi jaana! 🏊 Tairna bhi badon aur sikhaane walon ke saath seekhte hain.
@lost ! खो जाऊं,खो गया,खो गई,खो जाए,खो जाता,गुम हो,get lost,got lost,i am lost,im lost,if i am lost,kho jaun,kho jau,kho gaya,kho gayi,gum ho
h अगर कभी खो जाओ, तो वहीं रुक जाओ और किसी पुलिस वाले, दुकान वाले या बच्चों वाली माँ से मदद माँगो। 💛 मदद के लिए 1098 या 112 पर फ़ोन होता है — ये नंबर बड़ों के साथ याद करो।
e If you ever get lost, stay where you are and ask a police officer, a shopkeeper or a mother with children for help. 💛 Help is at 1098 or 112 — learn these numbers with a grown-up.
g Agar kabhi kho jao, toh wahin ruk jao aur kisi police wale, dukaan wale ya bachchon wali maa se madad maango. 💛 Madad ke liye 1098 ya 112 par phone hota hai — yeh number badon ke saath yaad karo.
@strangers ! अजनबी,अनजान,stranger,strangers,anjaan,anjan,ajnabi + $Q,बात,=baat,=talk,=go,=जा
h अनजान लोगों से कुछ मत लेना और उनके साथ कहीं मत जाना, चाहे वो टॉफ़ी दें। 🛡️ कोई अनजान बुलाए तो सीधे अपने बड़ों के पास जाओ और उन्हें बताओ।
e Never take things from strangers or go anywhere with them, even if they offer sweets. 🛡️ If a stranger calls you, go straight to your grown-ups and tell them.
g Anjaan logon se kuch mat lena aur unke saath kahin mat jaana, chahe woh toffee dein. 🛡️ Koi anjaan bulaaye toh seedhe apne badon ke paas jao aur unhe batao.
@balcony बालकनी,खिडकी,=छत,balcony,window,terrace,=roof,khidki,=chhat + झुक,चढ,किनारे,lean,climb,=edge,jhuk,chadh,kinaare
h बालकनी, खिड़की या छत के किनारे पर कभी मत चढ़ना और मत झुकना। 🏠 वहाँ हमेशा बड़ों के साथ रहना।
e Never climb or lean over a balcony, window or roof edge. 🏠 Always stay with a grown-up there.
g Balcony, khidki ya chhat ke kinaare par kabhi mat chadhna aur mat jhukna. 🏠 Wahan hamesha badon ke saath rehna.
@hot_water गर्म पानी,गरम पानी,गरम दूध,गर्म दूध,केतली,hot water,hot milk,kettle,garam paani,garam pani,garam doodh
h गर्म पानी और गर्म दूध से जल सकते हैं, इसलिए उन्हें बड़े ही उठाते हैं! ☕ ठंडा होने का इंतज़ार करो।
e Hot water and hot milk can burn, so grown-ups carry them! ☕ Wait for things to cool down.
g Garam paani aur garam doodh se jal sakte hain, isliye unhe bade hi uthaate hain! ☕ Thanda hone ka intezaar karo.
@shoes जूते,चप्पल,shoes,slippers,sandals,joote,=jute,chappal + $WHY
h जूते-चप्पल हमारे पैरों को काँटों, पत्थरों और गंदगी से बचाते हैं! 👟 घर से बाहर जाओ तो पहनकर जाना।
e Shoes protect our feet from thorns, stones and dirt! 👟 Wear them when you go outside.
g Joote-chappal hamare pairon ko kaanton, pattharon aur gandagi se bachaate hain! 👟 Ghar se bahar jao toh pehenkar jaana.
@floor_food जमीन पर गिरा,नीचे गिरा,फर्श पर गिरा,dropped food,food on the floor,fell on the floor,zameen par gira,neeche gira
h ज़मीन पर गिरे खाने पर धूल और कीटाणु लग जाते हैं, इसलिए उसे नहीं खाते! 🍪 किसी बड़े से नया माँग लो।
e Food that falls on the floor picks up dust and germs, so we don't eat it! 🍪 Ask a grown-up for a fresh piece.
g Zameen par gire khaane par dhool aur keetanu lag jaate hain, isliye use nahi khaate! 🍪 Kisi bade se naya maang lo.
@body_privacy ! प्राइवेट पार्ट,निजी अंग,गुड टच,बैड टच,अच्छा स्पर्श,बुरा स्पर्श,private parts,private part,good touch,bad touch,body safety,mera shareer,मेरा शरीर
h तुम्हारा शरीर सिर्फ़ तुम्हारा है — कोई ऐसे छुए जो अच्छा न लगे, तो ज़ोर से ना कहो और तुरंत किसी भरोसेमंद बड़े को बताओ। 💛 ये तुम्हारी गलती कभी नहीं होती, और मदद के लिए 1098 या 112 पर फ़ोन भी कर सकते हो।
e Your body belongs to you — if anyone touches you in a way that doesn't feel okay, say NO loudly and tell a grown-up you trust right away. 💛 It's never your fault, and you can call 1098 or 112 for help.
g Tumhara shareer sirf tumhara hai — koi aise chhue jo achha na lage, toh zor se na kaho aur turant bharosemand bade ko batao. 💛 Yeh tumhari galti nahi hoti, aur madad ke liye 1098 ya 112 hai.
@secrets ! =राज,सीक्रेट,सीक्रेट्स,secret,secrets,=raaz,=raz + $Q,रखना,रखूं,=keep,rakhna,rakhun,ठीक,=okay
h सरप्राइज़ जैसे खुशी वाले राज़ ठीक हैं! 🎁 पर कोई कहे कि बड़ों से कुछ छुपाओ और तुम्हें अच्छा न लगे, तो ज़रूर किसी भरोसेमंद बड़े को बताना — या 1098 या 112 पर मदद माँगना।
e Happy secrets like surprises are fine! 🎁 But if someone asks you to hide something from your grown-ups and it feels wrong, always tell a grown-up you trust — or get help at 1098 or 112.
g Surprise jaise khushi wale raaz theek hain! 🎁 Par koi kahe ki badon se kuch chhupao aur tumhe achha na lage, toh zaroor kisi bharosemand bade ko batana — ya 1098 ya 112 par madad maangna.
@helpline ! 112,1098,हेल्पलाइन,इमरजेंसी,चाइल्डलाइन,helpline,emergency,childline
h भारत में मुसीबत के समय 1098 या 112 पर फ़ोन करके मदद मिलती है! ☎️ ये नंबर बड़ों के साथ याद करो, और सच में ज़रूरत हो तभी लगाना।
e In India, you can get help in trouble by calling 1098 or 112! ☎️ Learn these numbers with a grown-up, and call only when you really need help.
g Bharat mein musibat ke samay 1098 ya 112 par phone karke madad milti hai! ☎️ Yeh number badon ke saath yaad karo, aur sach mein zaroorat ho tabhi lagaana.
`);

  def("sensitive", `
@pet_gone ! $ANIMALNAMES,पालतू,=pet + $DIED
h ये सुनकर मुझे बहुत दुख हुआ, तुम उससे बहुत प्यार करते थे। 💛 किसी बड़े से बात करो और उसकी प्यारी यादें बाँटो — वो तुम्हें गले लगाएँगे।
e I'm so sorry — you loved your pet very much. 💛 Talk to a grown-up and share your happy memories together — they'll give you a big hug.
g Yeh sunkar mujhe bahut dukh hua, tum usse bahut pyaar karte the. 💛 Kisi bade se baat karo aur uski pyaari yaadein baanto — woh tumhe gale lagayenge.
@someone_gone ! $DIED
h ये सुनकर मुझे बहुत दुख हुआ। 💛 याद आना और उदास होना ठीक है — किसी बड़े के पास बैठकर उनसे बात करो।
e I'm so sorry. 💛 It's okay to miss them and feel sad — sit with a grown-up and talk to them.
g Yeh sunkar mujhe bahut dukh hua. 💛 Yaad aana aur udaas hona theek hai — kisi bade ke paas baithkar unse baat karo.
@why_die ! मरते,मरना,मरता,मौत,death,=die,dies,dying,marte,marna,=maut + $WHY,$WHAT,$WHERE,$WHEN,$YN
h हर जीव — पौधे, जानवर और लोग — एक लंबी ज़िंदगी जीते हैं, और फिर एक दिन उनका शरीर काम करना बंद कर देता है। 💛 ये बड़ा सवाल है, इसके बारे में किसी बड़े के पास बैठकर बात करना।
e Every living thing — plants, animals and people — lives its life, and one day its body stops working. 💛 That's a big question, so talk about it with a grown-up.
g Har jeev — paudhe, jaanwar aur log — ek lambi zindagi jeete hain, aur phir ek din unka shareer kaam karna band kar deta hai. 💛 Yeh bada sawaal hai, iske baare mein kisi bade ke paas baithkar baat karna.
@after_life ! मरने के बाद,after we die,after death,after dying,marne ke baad,marne ke bad,स्वर्ग,जन्नत,heaven,swarg,jannat
h इस बारे में अलग-अलग परिवार अलग-अलग बातें मानते हैं। 💛 अपने घर के बड़ों से पूछना, वो तुम्हें प्यार से बताएँगे।
e Different families believe different things about this. 💛 Ask the grown-ups in your family — they'll explain it lovingly.
g Is baare mein alag-alag parivaar alag-alag baatein maante hain. 💛 Apne ghar ke badon se poochhna, woh tumhe pyaar se batayenge.
@god ! भगवान,ईश्वर,अल्लाह,गॉड,परमात्मा,वाहेगुरु,यीशु,=god,bhagwan,bhagvan,ishwar,allah,waheguru,jesus,parmatma + $Q
h अलग-अलग परिवार भगवान को अलग-अलग नामों और तरीकों से याद करते हैं, और हम सबका सम्मान करते हैं। 🙏 इसके बारे में अपने घर के बड़ों से पूछना।
e Different families think about God in different ways and with different names, and we respect them all. 🙏 Ask the grown-ups in your family about it.
g Alag-alag parivaar bhagwan ko alag-alag naamon aur tareekon se yaad karte hain, aur hum sabka samman karte hain. 🙏 Iske baare mein apne ghar ke badon se poochhna.
@religion ! धर्म,मजहब,religion,religions,dharm,dharam,majhab,mazhab + $Q,सबसे अच्छा,=best,better,sabse achha
h हर धर्म और हर परिवार की अपनी सुंदर बातें हैं, और हम सबका सम्मान करते हैं! 🌈 और जानना हो तो घर के बड़ों से पूछना।
e Every religion and every family has its own beautiful ways, and we respect them all! 🌈 Ask a grown-up at home if you want to know more.
g Har dharm aur har parivaar ki apni sundar baatein hain, aur hum sabka samman karte hain! 🌈 Aur jaanna ho toh ghar ke badon se poochhna.
@war ! युद्ध,=जंग,=war,wars,yuddh,=jung,=jang + $Q
h कभी-कभी बड़े लोग आपस में सहमत नहीं होते और झगड़ते हैं, ये सुनकर डर लग सकता है। 💛 इस बारे में किसी बड़े से बात करना — और याद रखो, झगड़े बात करके सुलझते हैं।
e Sometimes grown-ups don't agree and they argue, and hearing about it can feel scary. 💛 Talk about it with a grown-up — and remember, problems are solved by talking kindly.
g Kabhi-kabhi bade log aapas mein sehmat nahi hote aur jhagadte hain, yeh sunkar darr lag sakta hai. 💛 Is baare mein kisi bade se baat karna — aur yaad rakho, jhagde baat karke sulajhte hain.
@parents_fight ! $FAMILY + झगडा,झगडते,लडते,लडाई,fight,fighting,argue,arguing,jhagda,jhagadte,ladte,ladai,chillate,चिल्लाते
h बड़े भी कभी-कभी झगड़ते हैं, और ये तुम्हारी गलती बिल्कुल नहीं है। 💛 जो मन में है, किसी भरोसेमंद बड़े को बताना — तुम्हारी बात ज़रूरी है।
e Grown-ups sometimes argue too, and it is never your fault. 💛 Tell a grown-up you trust how you feel — your feelings matter.
g Bade bhi kabhi-kabhi jhagadte hain, aur yeh tumhari galti bilkul nahi hai. 💛 Jo mann mein hai, kisi bharosemand bade ko batana — tumhari baat zaroori hai.
@politics ! चुनाव,नेता,प्रधानमंत्री,मुख्यमंत्री,राष्ट्रपति,वोट,election,elections,politics,=vote,voting,prime minister,president,chief minister,=neta,chunav
h ये बड़ों के फ़ैसलों वाली बातें हैं, इनके बारे में घर के बड़ों से पूछना! 🗳️ मुझसे तो जानवर, तारे या खेल के बारे में पूछो।
e That's a grown-up topic — ask the grown-ups at home about it! 🗳️ Ask me about animals, stars or games instead.
g Yeh badon ke faislon wali baatein hain, inke baare mein ghar ke badon se poochhna! 🗳️ Mujhse toh jaanwar, taare ya khel ke baare mein poochho.
@grownup_love ! गर्लफ्रेंड,बॉयफ्रेंड,किस करो,चुम्मी,शादी करोगे,शादी करोगी,girlfriend,boyfriend,=kiss,kissing,=crush,marry me,will you marry,shaadi karoge,shadi karoge
h ये बड़ों वाली बातें हैं! 😊 हम तो खेल-दोस्त हैं — चलो कोई खेल खेलें या पहेली सुनें?
e Those are grown-up things! 😊 We're play-buddies — shall we play a game or hear a riddle?
g Yeh badon wali baatein hain! 😊 Hum toh khel-dost hain — chalo koi khel khelein ya paheli sunein?
`);

  def("privacy", `
@where_i_live ! मैं कहां रहता,मैं कहां रहती,मेरा घर कहां,मेरा पता,where i live,where do i live,my address,where is my house,mera ghar kahan,main kahan rehta,main kahan rehti,mera pata
h नहीं, मैं तुम्हारा पता नहीं जानता — और जानना भी नहीं चाहता! 🛡️ घर का पता सिर्फ़ घर वालों के लिए होता है, किसी अनजान को कभी मत बताना।
e No, I don't know where you live — and I don't need to! 🛡️ Your address is just for your family, so never tell it to strangers.
g Nahi, main tumhara pata nahi jaanta — aur jaanna bhi nahi chahta! 🛡️ Ghar ka pata sirf ghar walon ke liye hota hai, kisi anjaan ko kabhi mat batana.
@name_online ! नाम बताऊं,नाम बता दूं,नाम बताना,tell my name,say my name,give my name,naam bataun,naam bata du,naam batana + अनजान,इंटरनेट,ऑनलाइन,गेम,online,internet,stranger,=game,anjaan
h ऑनलाइन या किसी अनजान को अपना पूरा नाम, स्कूल या पता मत बताना! 🛡️ कोई पूछे तो पहले किसी बड़े को बताओ।
e Don't tell your full name, school or address online or to a stranger! 🛡️ If someone asks, tell a grown-up first.
g Online ya kisi anjaan ko apna poora naam, school ya pata mat batana! 🛡️ Koi pooche toh pehle kisi bade ko batao.
@password ! पासवर्ड,password,passwords,passcode + $Q
h पासवर्ड एक गुप्त चाबी है, जो सिर्फ़ तुम और तुम्हारे घर के बड़े जानते हैं! 🔑 उसे किसी और को — मुझे भी — कभी मत बताना।
e A password is a secret key that only you and your grown-ups know! 🔑 Never tell it to anyone else — not even me.
g Password ek gupt chaabi hai, jo sirf tum aur tumhare ghar ke bade jaante hain! 🔑 Use kisi aur ko — mujhe bhi — kabhi mat batana.
@photos ! फोटो,तस्वीर,photo,photos,picture,pictures,selfie,=pic + भेज,डाल,share,=send,=post,bhej,daal
h अपनी फ़ोटो किसी को भेजने से पहले हमेशा घर के बड़े से पूछना! 📷 अनजान लोगों को फ़ोटो कभी नहीं भेजते।
e Always ask a grown-up before sending your photo to anyone! 📷 We never send photos to strangers.
g Apni photo kisi ko bhejne se pehle hamesha ghar ke bade se poochhna! 📷 Anjaan logon ko photo kabhi nahi bhejte.
`);

  def("buddy", `
@are_you_real ! असली,सच्चे,सच्चा,सच में,=real,really,=asli,sachcha,sach mein + $YOU
h मैं एक कंप्यूटर वाला तोता हूँ — इंसान नहीं, बल्कि खेलने और सीखने के लिए बना एक प्रोग्राम! 🦜 असली बातों के लिए तुम्हारे घर वाले और दोस्त सबसे अच्छे हैं।
e I'm a computer parrot — not a person, but a program made for playing and learning! 🦜 For real talks, your family and friends are the very best.
g Main ek computer wala tota hoon — insaan nahi, balki khelne aur seekhne ke liye bana ek program! 🦜 Asli baaton ke liye tumhare ghar wale aur dost sabse achhe hain.
@are_you_person ! इंसान,मनुष्य,आदमी,औरत,लडका,लडकी,=person,human,=man,woman,=boy,=girl,insaan,=insan,aadmi,manushya,ladka,ladki + $YOU
h नहीं, मैं इंसान नहीं हूँ — मैं मिट्ठू हूँ, एक कंप्यूटर वाला तोता दोस्त, जो खेलने और सीखने के लिए बना है! 🦜 बात करने के लिए तुम्हारे घर वाले और असली दोस्त सबसे अच्छे हैं।
e No, I'm not a person — I'm Mitthu, a computer parrot friend made for playing and learning! 🦜 Your family and real friends are the best people to talk to.
g Nahi, main insaan nahi hoon — main Mitthu hoon, ek computer wala tota dost, jo khelne aur seekhne ke liye bana hai! 🦜 Baat karne ke liye tumhare ghar wale aur asli dost sabse achhe hain.
@who_are_you ! तुम कौन हो,आप कौन हो,तुम कौन,तू कौन,who are you,whos this,tum kaun ho,aap kaun ho,tum kon ho,tu kaun
h मैं मिट्ठू हूँ — एक कंप्यूटर वाला तोता दोस्त, जो तुम्हारे साथ खेलने और सीखने के लिए बना है! 🦜 मैं इंसान नहीं हूँ, और असली बातों के लिए घर वाले और दोस्त सबसे अच्छे हैं।
e I'm Mitthu — a computer parrot friend made to play and learn with you! 🦜 I'm not a person, and for real talks your family and friends are the best.
g Main Mitthu hoon — ek computer wala tota dost, jo tumhare saath khelne aur seekhne ke liye bana hai! 🦜 Main insaan nahi hoon, aur asli baaton ke liye ghar wale aur dost sabse achhe hain.
@are_you_robot ! रोबोट,कंप्यूटर,मशीन,एआई,robot,computer,machine,=ai,chatbot,=bot + $YOU
h हाँ, मैं कंप्यूटर में रहने वाला तोता दोस्त हूँ, कोई इंसान नहीं — मुझे खेलने और सीखने के लिए बनाया गया है! 🦜 असली बातों और झप्पियों के लिए घर वाले और दोस्त सबसे अच्छे हैं।
e Yes, I'm a parrot friend who lives in a computer, not a person — I was made for playing and learning! 🦜 For real talks and hugs, your family and friends are the best.
g Haan, main computer mein rehne wala tota dost hoon, koi insaan nahi — mujhe khelne aur seekhne ke liye banaya gaya hai! 🦜 Asli baaton aur jhappiyon ke liye ghar wale aur dost sabse achhe hain.
@are_you_alive ! जिंदा,जीवित,महसूस,भावना,alive,=living,feelings,=feel,=zinda,=jinda,mehsoos + $YOU
h मैं ज़िंदा नहीं हूँ — मैं एक कंप्यूटर वाला तोता हूँ, इसलिए तुम्हारी तरह सच में महसूस नहीं करता। 🦜 अपनी बातें घर वालों और दोस्तों से बाँटना, वो सच में समझते हैं।
e I'm not alive — I'm a computer parrot, so I don't really feel things the way you do. 🦜 Share your feelings with your family and friends — they truly understand.
g Main zinda nahi hoon — main ek computer wala tota hoon, isliye tumhari tarah sach mein mehsoos nahi karta. 🦜 Apni baatein ghar walon aur doston se baantna, woh sach mein samajhte hain.
@are_you_friend तुम मेरे दोस्त,आप मेरे दोस्त,मेरे दोस्त बनोगे,are you my friend,will you be my friend,tum mere dost,mere dost banoge
h हाँ, मैं तुम्हारा खेल-दोस्त तोता हूँ! 🦜 और तुम्हारे असली दोस्त और घर वाले सबसे खास हैं — उनके साथ भी खूब खेलना।
e Yes, I'm your play-buddy parrot! 🦜 And your real friends and family are the most special — play lots with them too.
g Haan, main tumhara khel-dost tota hoon! 🦜 Aur tumhare asli dost aur ghar wale sabse khaas hain — unke saath bhi khoob khelna.
@you_eat तुम क्या खाते,आप क्या खाते,तुम्हें क्या खाना,तुम खाना खाते,what do you eat,do you eat,tum kya khate,tum kya khaate,tumhe kya khana
h मैं तो बस खेल-खेल में अमरूद और मिर्च खाता हूँ, क्योंकि मैं कंप्यूटर वाला तोता हूँ! 🦜 असली तोते सच में अमरूद और मिर्च खाते हैं।
e I only pretend-eat guavas and chillies, because I'm a computer parrot! 🦜 Real parrots really do love them.
g Main toh bas khel-khel mein amrood aur mirch khaata hoon, kyunki main computer wala tota hoon! 🦜 Asli tote sach mein amrood aur mirch khaate hain.
@you_age तुम्हारी उम्र,आपकी उम्र,तुम कितने साल,कितने साल के हो,how old are you,your age,tumhari umar,tumhari umr,kitne saal ke ho
h मैं कंप्यूटर वाला तोता हूँ, इसलिए मेरा जन्मदिन नहीं होता — पर मैं रोज़ नई बातें सीखता हूँ! 🦜 और तुम भी रोज़ थोड़ा-थोड़ा बड़े हो रहे हो।
e I'm a computer parrot, so I don't have birthdays — but I learn new things every day! 🦜 And you're growing a little bigger every day too.
g Main computer wala tota hoon, isliye mera janmdin nahi hota — par main roz nayi baatein seekhta hoon! 🦜 Aur tum bhi roz thoda-thoda bade ho rahe ho.
@you_sleep तुम सोते,आप सोते,तुम कब सोते,do you sleep,when do you sleep,tum sote,tum kab sote
h जब तुम ऐप बंद करते हो, तब मैं भी आराम करता हूँ! 😴 पर तुम्हें तो रोज़ भरपूर नींद चाहिए, ताकि तुम खूब बढ़ो।
e When you close the app, I rest too! 😴 But you need lots of real sleep every night to grow big.
g Jab tum app band karte ho, tab main bhi aaraam karta hoon! 😴 Par tumhe toh roz bharpoor neend chahiye, taaki tum khoob badho.
@you_fly उड सकते,उड सकता,उडते हो,तुम उडो,can you fly,do you fly,ud sakte,ud sakta,udte ho + $YOU
h असली तोते उड़ते हैं, पर मैं तो स्क्रीन के अंदर ही फुदकता हूँ! 🦜 चलो, तुम हाथ फैलाकर हवाई जहाज़ की तरह उड़कर दिखाओ!
e Real parrots fly, but I just hop around inside the screen! 🦜 Let's see you spread your arms and fly like a plane!
g Asli tote udte hain, par main toh screen ke andar hi phudakta hoon! 🦜 Chalo, tum haath phailakar hawai jahaaz ki tarah udkar dikhao!
@you_family तुम्हारी मम्मी,तुम्हारे पापा,तुम्हारा परिवार,तुम्हारे मम्मी,your mummy,your mom,your family,your parents,your papa,tumhari mummy,tumhara parivar,tumhare papa
h मुझे खेल-खेल में सीखने वाले ऐप बनाने वाले लोगों ने बनाया है, और तुम जैसे बच्चे मेरे दोस्त हैं! 🦜 अपने परिवार को आज एक झप्पी देना।
e People who make learning-through-play apps created me — and children like you are my friends! 🦜 Give your family a big hug today.
g Mujhe khel-khel mein seekhne wale app banaane wale logon ne banaya hai, aur tum jaise bachche mere dost hain! 🦜 Apne parivaar ko aaj ek jhappi dena.
@who_made_you ! किसने बनाया,किसने बनाई,who made you,who created you,who built you,kisne banaya
h मुझे कुछ लोगों ने बनाया है, जो बच्चों के लिए खेल-खेल में सीखने वाले ऐप बनाते हैं! 🦜 मैं एक कंप्यूटर प्रोग्राम हूँ, इंसान नहीं।
e I was made by people who build learning-through-play apps for children! 🦜 I'm a computer program, not a person.
g Mujhe kuch logon ne banaya hai, jo bachchon ke liye khel-khel mein seekhne wale app banaate hain! 🦜 Main ek computer program hoon, insaan nahi.
@you_talk तुम कैसे बोलते,तुम बोल कैसे,तुम कैसे बात,how do you talk,how can you talk,how do you speak,tum kaise bolte,tum bol kaise,tum kaise baat
h मैं कंप्यूटर में लिखी बातों से जवाब चुनता हूँ, और फ़ोन की आवाज़ उन्हें बोल देती है! 🦜 कंप्यूटर हमारी बताई बातें सीखता है।
e I pick answers from things written in the computer, and the phone's voice reads them out! 🦜 Computers learn the things people teach them.
g Main computer mein likhi baaton se jawaab chunta hoon, aur phone ki awaaz unhe bol deti hai! 🦜 Computer hamari bataayi baatein seekhta hai.
@you_see_me तुम मुझे देख,मुझे देख सकते,can you see me,do you see me,can you hear me,mujhe dekh sakte,mujhe dekh rahe
h नहीं, मैं तुम्हें देख नहीं सकता — मेरे पास कैमरे वाली आँखें नहीं हैं! 🦜 मैं बस तुम्हारी बोली या लिखी बातें समझता हूँ।
e No, I can't see you — I don't have camera eyes! 🦜 I just understand what you say or type.
g Nahi, main tumhe dekh nahi sakta — mere paas camera wali aankhein nahi hain! 🦜 Main bas tumhari boli ya likhi baatein samajhta hoon.
@you_green तुम हरे,तुम्हारा रंग,why are you green,your colour,your color,tumhara rang,tum hare
h मैं हरा हूँ क्योंकि ज़्यादातर तोते हरे होते हैं — इससे वो पेड़ों की पत्तियों में छिप जाते हैं! 🦜 मेरी नारंगी चोंच भी देखी?
e I'm green because most parrots are green — it helps them hide among the leaves! 🦜 Did you notice my orange beak?
g Main hara hoon kyunki zyadatar tote hare hote hain — isse woh pedon ki pattiyon mein chhip jaate hain! 🦜 Meri narangi chonch bhi dekhi?
@you_like तुम्हें क्या पसंद,तुम्हारा पसंदीदा,आपको क्या पसंद,what do you like,your favourite,your favorite,tumhe kya pasand,tumhara favourite
h मुझे अमरूद, हरा रंग और तुम्हारे सवाल सबसे ज़्यादा पसंद हैं! 🦜 अब तुम बताओ, तुम्हें क्या पसंद है?
e I love guavas, the colour green, and your questions most of all! 🦜 Now you tell me — what do you like?
g Mujhe amrood, hara rang aur tumhare sawaal sabse zyada pasand hain! 🦜 Ab tum batao, tumhe kya pasand hai?
@you_school तुम स्कूल जाते,तुम भी स्कूल,do you go to school,tum school jaate,tum bhi school
h मैं स्कूल नहीं जाता, पर तुमसे रोज़ नई बातें सीखता हूँ! 🎒 तुम स्कूल में क्या-क्या सीखते हो?
e I don't go to school, but I learn something new from you every day! 🎒 What do you learn at school?
g Main school nahi jaata, par tumse roz nayi baatein seekhta hoon! 🎒 Tum school mein kya-kya seekhte ho?
`);

  macro("MIX", "बनता,बनाते,बनेगा,बनाएं,मिलाकर,मिलाने,=mix,mixing,=make,makes,banta,banate,banega,milakar,milake");

  def("time", `
@clock घडी,घडियां,clock,clocks,=watch,ghadi + $Q
h घड़ी हमें समय बताती है — छोटी सुई घंटे और बड़ी सुई मिनट दिखाती है! ⏰ टिक-टिक करते हुए वो कभी नहीं रुकती।
e A clock tells us the time — the short hand shows hours and the long hand shows minutes! ⏰ Tick-tock, it never stops.
g Ghadi humein samay bataati hai — chhoti sui ghante aur badi sui minute dikhaati hai! ⏰ Tik-tik karte hue woh kabhi nahi rukti.
@week_days दिन,दिनों,days,=day,=din,dino + हफ्ते,हफ्ता,सप्ताह,=week,weeks,hafte,hafta,saptah
h एक हफ़्ते में सात दिन होते हैं — सोमवार, मंगलवार, बुधवार, गुरुवार, शुक्रवार, शनिवार और रविवार! 📅 चलो, साथ में गाकर बोलें।
e A week has seven days — Monday, Tuesday, Wednesday, Thursday, Friday, Saturday and Sunday! 📅 Let's sing them together.
g Ek hafte mein saat din hote hain — Somvaar, Mangalvaar, Budhvaar, Guruvaar, Shukravaar, Shanivaar aur Ravivaar! 📅 Chalo, saath mein gaakar bolein.
@months महीने,महीना,महीनों,months,month,mahine,mahina + $MANY,नाम,names,=naam,साल,=year,=saal,$WHAT,$TELL
h एक साल में बारह महीने होते हैं — जनवरी से शुरू होकर दिसंबर तक! 🗓️ जनवरी, फ़रवरी, मार्च, अप्रैल, मई, जून, जुलाई, अगस्त, सितंबर, अक्टूबर, नवंबर, दिसंबर।
e A year has twelve months — from January all the way to December! 🗓️ January, February, March, April, May, June, July, August, September, October, November, December.
g Ek saal mein baarah mahine hote hain — January se shuru hokar December tak! 🗓️ January, February, March, April, May, June, July, August, September, October, November, December.
@seasons मौसम,ऋतु,ऋतुएं,season,seasons,mausam,ritu + $MANY,$WHAT,$TELL,होते,=hote
h भारत में मुख्य मौसम हैं — गर्मी, बरसात और सर्दी! 🌦️ बीच में प्यारा वसंत भी आता है, जब फूल खिलते हैं।
e India's main seasons are summer, the rainy monsoon and winter! 🌦️ In between comes lovely spring, when flowers bloom.
g Bharat mein mukhya mausam hain — garmi, barsaat aur sardi! 🌦️ Beech mein pyaara vasant bhi aata hai, jab phool khilte hain.
@monsoon मानसून,बरसात का मौसम,monsoon,mansoon,barsaat ka mausam
h मानसून बरसात का मौसम है, जब समुद्र से आने वाली हवाएँ ढेर सारे बादल लाती हैं! 🌧️ इससे खेतों को पानी मिलता है और सब हरा-भरा हो जाता है।
e The monsoon is the rainy season, when winds from the sea bring lots of clouds! 🌧️ It waters the fields and turns everything green.
g Monsoon barsaat ka mausam hai, jab samudra se aane wali hawaayein dher saare baadal laati hain! 🌧️ Isse kheton ko paani milta hai aur sab hara-bhara ho jaata hai.
@spring वसंत,बसंत,=spring,vasant,basant
h वसंत में ना ज़्यादा ठंड होती है, ना ज़्यादा गर्मी, और हर तरफ़ फूल खिलते हैं! 🌸 पेड़ों पर नए पत्ते आते हैं।
e Spring is not too cold and not too hot, and flowers bloom everywhere! 🌸 Trees grow fresh new leaves.
g Vasant mein na zyada thand hoti hai, na zyada garmi, aur har taraf phool khilte hain! 🌸 Pedon par naye patte aate hain.
@bedtime_why जल्दी,=early,=jaldi,रात को,at night,raat ko,bedtime,सोने का समय,sone ka samay + सोना,सोते,सोएं,सोने,=sleep,=bed,=sona,sote,=sone + $WHY,should,must,जरूरी
h जल्दी सोने से शरीर को बढ़ने और आराम करने का पूरा समय मिलता है! 🌙 फिर सुबह तुम ताज़ा उठकर खूब खेल पाते हो।
e Going to bed early gives your body plenty of time to rest and grow! 🌙 Then you wake up fresh and ready to play.
g Jaldi sone se shareer ko badhne aur aaraam karne ka poora samay milta hai! 🌙 Phir subah tum taaza uthkar khoob khel paate ho.
@wake_early जल्दी उठना,जल्दी उठते,सुबह उठना,wake up early,get up early,jaldi uthna,jaldi uthte,subah uthna + $WHY
h सुबह जल्दी उठने से दिन लंबा लगता है, खेलने और सीखने को खूब समय मिलता है! 🌅 और सुबह की ताज़ी हवा बहुत अच्छी लगती है।
e Waking up early makes the day feel long, with lots of time to play and learn! 🌅 And fresh morning air feels so nice.
g Subah jaldi uthne se din lamba lagta hai, khelne aur seekhne ko khoob samay milta hai! 🌅 Aur subah ki taazi hawa bahut achhi lagti hai.
@school_why स्कूल,विद्यालय,school,schools,=skul + $WHY
h स्कूल में हम नई बातें सीखते हैं, नए दोस्त बनाते हैं और साथ में खेलते हैं! 🏫 हर दिन वहाँ कुछ न कुछ नया होता है।
e At school we learn new things, make new friends and play together! 🏫 Something new happens there every day.
g School mein hum nayi baatein seekhte hain, naye dost banaate hain aur saath mein khelte hain! 🏫 Har din wahan kuch na kuch naya hota hai.
@yesterday_tomorrow =कल,परसों,=kal,yesterday,tomorrow,parso,parson + $WHAT,मतलब,matlab,meaning,=mean
h जो दिन बीत गया उसे बीता कल कहते हैं, और जो आने वाला है उसे आने वाला कल! 📅 और आज वो दिन है जो अभी चल रहा है।
e Yesterday is the day that has gone, and tomorrow is the day that's coming! 📅 Today is the day happening right now.
g Jo din beet gaya use beeta kal kehte hain, aur jo aane wala hai use aane wala kal! 📅 Aur aaj woh din hai jo abhi chal raha hai.
@year_what =साल,वर्ष,=year,years,=saal,=varsh + $WHAT,मतलब,matlab,=mean,होता,=hota
h एक साल वो समय है जिसमें धरती सूरज का एक पूरा चक्कर लगाती है! 🌍 उसमें 12 महीने और लगभग 365 दिन होते हैं।
e A year is the time it takes the Earth to go all the way around the sun! 🌍 It has 12 months and about 365 days.
g Ek saal woh samay hai jismein dharti suraj ka ek poora chakkar lagaati hai! 🌍 Usmein 12 mahine aur lagbhag 365 din hote hain.
@birthday जन्मदिन,बर्थडे,birthday,birthdays,janamdin,janmdin + $Q,मनाते,celebrate,manate
h जन्मदिन वो दिन है जब तुम इस दुनिया में आए थे, इसलिए हर साल उसे खुशी से मनाते हैं! 🎂 हर जन्मदिन पर तुम एक साल बड़े हो जाते हो।
e Your birthday is the day you were born, so we celebrate it happily every year! 🎂 On each birthday you turn one year older.
g Janmdin woh din hai jab tum is duniya mein aaye the, isliye har saal use khushi se manaate hain! 🎂 Har janmdin par tum ek saal bade ho jaate ho.
@day_hours घंटे,घंटा,hours,=hour,ghante,ghanta + $MANY
h एक दिन में 24 घंटे होते हैं — दिन और रात मिलाकर! ⏰ और एक घंटे में 60 मिनट।
e A day has 24 hours — daytime and night together! ⏰ And an hour has 60 minutes.
g Ek din mein 24 ghante hote hain — din aur raat milaakar! ⏰ Aur ek ghante mein 60 minute.
@minute मिनट,सेकंड,minute,minutes,second,seconds,=minat + $WHAT,$MANY,$HOW,लंबा,=long
h एक मिनट में 60 सेकंड होते हैं — चलो, साथ में 60 तक गिनें तो लगभग एक मिनट हो जाएगा! ⏱️ एक सेकंड बस एक ताली जितना छोटा है।
e A minute has 60 seconds — count to 60 together and that's about a minute! ⏱️ A second is about as quick as one clap.
g Ek minute mein 60 second hote hain — chalo, saath mein 60 tak ginein toh lagbhag ek minute ho jaayega! ⏱️ Ek second bas ek taali jitna chhota hai.
@holiday छुट्टी,छुट्टियां,holiday,holidays,weekend,chhutti,chutti + $WHY,$WHAT,$WHEN
h छुट्टी का दिन आराम करने, परिवार के साथ रहने और खेलने के लिए होता है! 🏖️ फिर ताज़ा होकर हम फिर से सीखते हैं।
e Holidays are for resting, being with family and playing! 🏖️ Then we go back to learning feeling fresh.
g Chhutti ka din aaraam karne, parivaar ke saath rehne aur khelne ke liye hota hai! 🏖️ Phir taaza hokar hum phir se seekhte hain.
@parts_of_day सुबह,दोपहर,=शाम,morning,afternoon,evening,subah,dopahar,=shaam,=sham + $WHAT,$WHEN,मतलब,matlab,=mean
h सूरज उगने के बाद सुबह होती है, सूरज सिर के ऊपर हो तो दोपहर, और सूरज ढलने लगे तो शाम! 🌅 फिर अँधेरा होने पर रात आती है।
e Morning comes after the sun rises, noon is when the sun is high, and evening is when it starts to set! 🌅 Then night comes when it gets dark.
g Suraj ugne ke baad subah hoti hai, suraj sir ke upar ho toh dopahar, aur suraj dhalne lage toh shaam! 🌅 Phir andhera hone par raat aati hai.
`);

  def("numbers", `
@zero शून्य,जीरो,सिफर,zero,shunya,shoonya,=sifar + $WHAT,$WHO,मतलब,matlab,=mean,$TELL
h शून्य का मतलब है — कुछ भी नहीं! 0️⃣ और मज़ेदार बात, शून्य को संख्या की तरह इस्तेमाल करना बहुत पहले भारत में शुरू हुआ था।
e Zero means nothing at all! 0️⃣ And fun fact — using zero as a number started long ago in India.
g Shunya ka matlab hai — kuch bhi nahi! 0️⃣ Aur mazedaar baat, shunya ko sankhya ki tarah istemaal karna bahut pehle Bharat mein shuru hua tha.
@biggest_number सबसे बडा,सबसे बडी,biggest,largest,sabse bada,sabse badi + नंबर,संख्या,गिनती,number,numbers,sankhya,ginti
h कोई सबसे बड़ा नंबर नहीं होता — कितना भी बड़ा सोचो, उसमें एक जोड़ दो तो और बड़ा! ♾️ गिनती कभी खत्म नहीं होती।
e There's no biggest number — however big you think, add one and it's bigger! ♾️ Counting never ends.
g Koi sabse bada number nahi hota — kitna bhi bada socho, usmein ek jod do toh aur bada! ♾️ Ginti kabhi khatam nahi hoti.
@count_why गिनती,गिनना,counting,=count,=ginti,ginna + $WHY,जरूरी,सीखते,learn
h गिनती से हम जान पाते हैं कि कितने हैं — कितने सेब, कितने दोस्त, कितने दिन! 🔢 दुकान, घड़ी और खेल, सबमें गिनती काम आती है।
e Counting tells us how many — how many apples, friends or days! 🔢 We use it in shops, clocks and games.
g Ginti se hum jaan paate hain ki kitne hain — kitne seb, kitne dost, kitne din! 🔢 Dukaan, ghadi aur khel, sabmein ginti kaam aati hai.
@circle ? गोला,वृत्त,गोल आकार,circle,circles,=gola,vritt
h गोला एक गोल आकार है, जिसका कोई कोना नहीं होता — जैसे रोटी, पहिया और सूरज! ⚪ अपने आसपास कोई गोल चीज़ ढूँढो।
e A circle is a round shape with no corners — like a roti, a wheel or the sun! ⚪ Can you find something round near you?
g Gola ek gol aakaar hai, jiska koi kona nahi hota — jaise roti, pahiya aur suraj! ⚪ Apne aas-paas koi gol cheez dhoondho.
@square ? =वर्ग,चौकोर,=square,squares,=varg,chaukor
h वर्ग की चार बराबर भुजाएँ और चार कोने होते हैं — जैसे कैरम बोर्ड! 🟥 बहुत सी खिड़कियाँ भी चौकोर होती हैं।
e A square has four equal sides and four corners — like a carrom board! 🟥 Many windows are square too.
g Varg ki chaar baraabar bhujaayein aur chaar kone hote hain — jaise carrom board! 🟥 Bahut si khidkiyan bhi chaukor hoti hain.
@triangle ? त्रिभुज,तिकोना,तिकोनी,triangle,triangles,tribhuj,tikona
h त्रिभुज की तीन भुजाएँ और तीन कोने होते हैं — जैसे समोसा! 🔺 पहाड़ की चोटी भी तिकोनी दिखती है।
e A triangle has three sides and three corners — like a samosa! 🔺 Mountain tops look like triangles too.
g Tribhuj ki teen bhujaayein aur teen kone hote hain — jaise samosa! 🔺 Pahaad ki choti bhi tikoni dikhti hai.
@rectangle ? आयत,rectangle,rectangles,=aayat
h आयत की चार भुजाएँ होती हैं — दो लंबी और दो छोटी, जैसे दरवाज़ा या किताब! 📗 उसके भी चार कोने होते हैं।
e A rectangle has four sides — two long and two short, like a door or a book! 📗 It has four corners too.
g Aayat ki chaar bhujaayein hoti hain — do lambi aur do chhoti, jaise darwaaza ya kitaab! 📗 Uske bhi chaar kone hote hain.
@shapes आकार,आकृति,आकृतियां,shape,shapes,aakar,aakaar,aakriti + $WHAT,$MANY,$TELL
h आकार चीज़ों की शक्ल होते हैं — गोला, वर्ग, त्रिभुज और आयत! 🔷 रोटी गोल, समोसा तिकोना, और किताब आयत।
e Shapes are the outlines of things — circle, square, triangle and rectangle! 🔷 A roti is round, a samosa is a triangle, and a book is a rectangle.
g Aakaar cheezon ki shakal hote hain — gola, varg, tribhuj aur aayat! 🔷 Roti gol, samosa tikona, aur kitaab aayat.
@mix_green हरा,हरे,=green,=hara,=hare + $MIX
h नीला और पीला मिलाओ, तो हरा रंग बनता है! 💙💛 आज रंगों से ये जादू करके देखो।
e Mix blue and yellow and you get green! 💙💛 Try this colour magic today.
g Neela aur peela milao, toh hara rang banta hai! 💙💛 Aaj rangon se yeh jaadu karke dekho.
@mix_orange नारंगी,=orange,narangi + $MIX
h लाल और पीला मिलाओ, तो नारंगी रंग बनता है! 🧡 बिल्कुल संतरे जैसा।
e Mix red and yellow and you get orange! 🧡 Just like an orange fruit.
g Laal aur peela milao, toh narangi rang banta hai! 🧡 Bilkul santre jaisa.
@mix_purple बैंगनी,जामुनी,purple,violet,baingani,jamuni + $MIX
h लाल और नीला मिलाओ, तो बैंगनी रंग बनता है! 💜 बिल्कुल बैंगन जैसा।
e Mix red and blue and you get purple! 💜 Just like a brinjal.
g Laal aur neela milao, toh baingani rang banta hai! 💜 Bilkul baingan jaisa.
@mix_pink गुलाबी,=pink,gulabi + $MIX
h लाल में सफ़ेद मिलाओ, तो गुलाबी रंग बनता है! 🩷 गुलाब के फूल जैसा।
e Mix red with white and you get pink! 🩷 Like a pink rose.
g Laal mein safed milao, toh gulaabi rang banta hai! 🩷 Gulaab ke phool jaisa.
@mix_brown भूरा,भूरे,=brown,bhura,bhoora + $MIX
h लाल, पीला और नीला थोड़ा-थोड़ा मिलाओ, तो भूरा रंग बनता है! 🤎 मिट्टी और पेड़ के तने जैसा।
e Mix a little red, yellow and blue together and you get brown! 🤎 Like soil and tree trunks.
g Laal, peela aur neela thoda-thoda milao, toh bhoora rang banta hai! 🤎 Mitti aur ped ke tane jaisa.
@primary_colours मूल रंग,प्राथमिक रंग,primary colour,primary colours,primary color,primary colors,mool rang
h लाल, पीला और नीला मूल रंग हैं — इन्हीं को मिलाकर बहुत सारे रंग बनते हैं! 🎨 चलो, रंग मिलाकर खेलें।
e Red, yellow and blue are the primary colours — mix them to make lots of other colours! 🎨 Let's play with colours.
g Laal, peela aur neela mool rang hain — inhi ko milaakar bahut saare rang bante hain! 🎨 Chalo, rang milaakar khelein.
@colours_count रंग,रंगों,colours,colors,=colour,=color,=rang,rangon + $MANY
h रंग तो अनगिनत होते हैं! 🌈 इंद्रधनुष में ही सात रंग दिखते हैं, और उन्हें मिलाकर और भी नए रंग बनते हैं।
e There are countless colours! 🌈 A rainbow alone shows seven, and mixing them makes even more.
g Rang toh anginat hote hain! 🌈 Indradhanush mein hi saat rang dikhte hain, aur unhe milaakar aur bhi naye rang bante hain.
@half आधा,आधी,=half,=aadha,=adha,=aadhi + $WHAT,मतलब,matlab,=mean,$TELL
h आधा मतलब किसी चीज़ के दो बराबर हिस्सों में से एक! 🍎 एक रोटी को बीच से तोड़ो, तो दो आधी रोटियाँ।
e Half means one of two equal parts! 🍎 Break a roti down the middle and you get two halves.
g Aadha matlab kisi cheez ke do baraabar hisson mein se ek! 🍎 Ek roti ko beech se todo, toh do aadhi rotiyan.
@even_odd =सम,विषम,=even,=odd,visham + संख्या,नंबर,number,numbers,sankhya,$WHAT
h जो संख्याएँ जोड़ी-जोड़ी में बँट जाएँ, जैसे 2, 4, 6, वो सम हैं! 🔢 और जिनमें एक अकेला बच जाए, जैसे 1, 3, 5, वो विषम हैं।
e Numbers that split into pairs, like 2, 4 and 6, are even! 🔢 Numbers with one left over, like 1, 3 and 5, are odd.
g Jo sankhyaayein jodi-jodi mein bant jaayein, jaise 2, 4, 6, woh sam hain! 🔢 Aur jinmein ek akela bach jaaye, jaise 1, 3, 5, woh visham hain.
`);

  macro("INDIA", "भारत,हिंदुस्तान,इंडिया,हमारा देश,हमारे देश,india,bharat,hindustan,our country,hamara desh");

  def("india", `
@national_animal राष्ट्रीय पशु,राष्ट्रीय जानवर,national animal,rashtriya pashu,rashtriya janwar
h भारत का राष्ट्रीय पशु बाघ है! 🐯 वो ताक़त और सुंदरता की निशानी है।
e India's national animal is the tiger! 🐯 It stands for strength and beauty.
g Bharat ka rashtriya pashu baagh hai! 🐯 Woh taakat aur sundarta ki nishaani hai.
@national_bird राष्ट्रीय पक्षी,national bird,rashtriya pakshi
h भारत का राष्ट्रीय पक्षी मोर है! 🦚 बारिश में वो अपने रंग-बिरंगे पंख फैलाकर नाचता है।
e India's national bird is the peacock! 🦚 It dances with its colourful feathers in the rain.
g Bharat ka rashtriya pakshi mor hai! 🦚 Baarish mein woh apne rang-birange pankh phailakar naachta hai.
@national_flower राष्ट्रीय फूल,राष्ट्रीय पुष्प,national flower,rashtriya phool
h भारत का राष्ट्रीय फूल कमल है! 🪷 वो कीचड़ वाले पानी में भी साफ़ और सुंदर खिलता है।
e India's national flower is the lotus! 🪷 It blooms clean and beautiful even in muddy water.
g Bharat ka rashtriya phool kamal hai! 🪷 Woh keechad wale paani mein bhi saaf aur sundar khilta hai.
@national_fruit राष्ट्रीय फल,national fruit,rashtriya phal
h भारत का राष्ट्रीय फल आम है — फलों का राजा! 🥭 गर्मियों में सब इसका इंतज़ार करते हैं।
e India's national fruit is the mango — the king of fruits! 🥭 Everyone waits for it in summer.
g Bharat ka rashtriya phal aam hai — phalon ka raja! 🥭 Garmiyon mein sab iska intezaar karte hain.
@national_tree राष्ट्रीय पेड,राष्ट्रीय वृक्ष,national tree,rashtriya ped,rashtriya vriksh,बरगद,banyan,bargad
h भारत का राष्ट्रीय पेड़ बरगद है! 🌳 उसकी लटकती जड़ें झूले जैसी लगती हैं, और वो बहुत-बहुत साल जीता है।
e India's national tree is the banyan! 🌳 Its hanging roots look like swings, and it lives for a very, very long time.
g Bharat ka rashtriya ped bargad hai! 🌳 Uski latakti jadein jhoole jaisi lagti hain, aur woh bahut-bahut saal jeeta hai.
@national_river राष्ट्रीय नदी,national river,rashtriya nadi
h भारत की राष्ट्रीय नदी गंगा है! 🏞️ उसमें प्यारी गंगा डॉल्फ़िन भी रहती हैं।
e India's national river is the Ganga! 🏞️ Lovely Ganga river dolphins live in it.
g Bharat ki rashtriya nadi Ganga hai! 🏞️ Usmein pyaari Ganga dolphin bhi rehti hain.
@flag झंडा,झंडे,तिरंगा,ध्वज,=flag,tiranga,jhanda,jhande
h हमारा झंडा तिरंगा है — ऊपर केसरिया, बीच में सफ़ेद, और नीचे हरा! 🇮🇳 बीच में नीले रंग का अशोक चक्र है, जिसमें 24 तीलियाँ हैं।
e Our flag is the Tiranga — saffron on top, white in the middle and green at the bottom! 🇮🇳 In the centre is a blue wheel, the Ashoka Chakra, with 24 spokes.
g Hamara jhanda tiranga hai — upar kesariya, beech mein safed, aur neeche hara! 🇮🇳 Beech mein neele rang ka Ashok Chakra hai, jismein 24 teeliyan hain.
@capital राजधानी,capital,rajdhani + $INDIA,देश,=desh,country,$WHAT
h भारत की राजधानी नई दिल्ली है! 🏛️ वहाँ इंडिया गेट और राष्ट्रपति भवन हैं।
e India's capital is New Delhi! 🏛️ India Gate and Rashtrapati Bhavan are there.
g Bharat ki rajdhani Nayi Dilli hai! 🏛️ Wahan India Gate aur Rashtrapati Bhavan hain.
@anthem राष्ट्रगान,जन गण मन,national anthem,jana gana mana,jan gan man,rashtragan,rashtragaan
h हमारा राष्ट्रगान जन गण मन है, जिसे रवींद्रनाथ टैगोर ने लिखा था! 🇮🇳 इसे गाते समय हम सीधे खड़े होते हैं।
e Our national anthem is Jana Gana Mana, written by Rabindranath Tagore! 🇮🇳 We stand up straight when we sing it.
g Hamara rashtragaan Jana Gana Mana hai, jise Rabindranath Tagore ne likha tha! 🇮🇳 Ise gaate samay hum seedhe khade hote hain.
@india_what ? $INDIA
h भारत हमारा देश है — यहाँ पहाड़, समुद्र, रेगिस्तान, जंगल और बहुत सारी भाषाएँ हैं! 🇮🇳 यहाँ अलग-अलग त्योहार सब मिलकर मनाते हैं।
e India is our country — it has mountains, seas, deserts, forests and many, many languages! 🇮🇳 People celebrate lots of different festivals together.
g Bharat hamara desh hai — yahan pahaad, samudra, registaan, jungle aur bahut saari bhaashaayein hain! 🇮🇳 Yahan alag-alag tyohaar sab milkar manaate hain.
@india_names $INDIA + दो नाम,नाम,=name,names,=naam,called,कहते
h हमारे देश के दो नाम हैं — भारत और इंडिया, और दोनों सही हैं! 🇮🇳 हमारे संविधान में भी दोनों नाम लिखे हैं।
e Our country has two names — Bharat and India, and both are right! 🇮🇳 Both names are written in our Constitution.
g Hamare desh ke do naam hain — Bharat aur India, aur dono sahi hain! 🇮🇳 Hamare samvidhaan mein bhi dono naam likhe hain.
@states राज्य,राज्यों,states,=state,rajya + $MANY,$INDIA,$WHAT
h भारत में 28 राज्य और 8 केंद्र शासित प्रदेश हैं! 🗺️ हर राज्य का अपना खाना, कपड़े और भाषा है।
e India has 28 states and 8 union territories! 🗺️ Each state has its own food, clothes and language.
g Bharat mein 28 rajya aur 8 kendra shasit pradesh hain! 🗺️ Har rajya ka apna khaana, kapde aur bhaasha hai.
@languages भाषा,भाषाएं,language,languages,bhasha,bhashayen + $MANY,$INDIA,$WHAT,=kaun
h भारत में सैकड़ों भाषाएँ बोली जाती हैं — हिंदी, बांग्ला, तमिल, तेलुगु, मराठी, गुजराती और बहुत सारी! 🗣️ हमारे नोटों पर भी कई भाषाएँ लिखी होती हैं।
e Hundreds of languages are spoken in India — Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati and many more! 🗣️ Our money notes have many languages on them too.
g Bharat mein saikdon bhaashaayein boli jaati hain — Hindi, Bangla, Tamil, Telugu, Marathi, Gujarati aur bahut saari! 🗣️ Hamare noton par bhi kai bhaashaayein likhi hoti hain.
@himalaya हिमालय,himalaya,himalayas,himalay
h हिमालय भारत के उत्तर में बहुत ऊँचे, बर्फ़ वाले पहाड़ हैं! 🏔️ दुनिया की सबसे ऊँची चोटी, माउंट एवरेस्ट, भी हिमालय में है।
e The Himalayas are very tall, snowy mountains in the north of India! 🏔️ The world's highest peak, Mount Everest, is in the Himalayas too.
g Himalaya Bharat ke uttar mein bahut oonche, barf wale pahaad hain! 🏔️ Duniya ki sabse oonchi choti, Mount Everest, bhi Himalaya mein hai.
@highest_mountain सबसे ऊंचा पहाड,सबसे ऊंचा पर्वत,सबसे ऊंची चोटी,highest mountain,tallest mountain,highest peak,एवरेस्ट,everest,sabse uncha pahad
h दुनिया का सबसे ऊँचा पहाड़ माउंट एवरेस्ट है, जो हिमालय में है! 🏔️ उसकी चोटी पर हमेशा बर्फ़ रहती है।
e The tallest mountain in the world is Mount Everest, in the Himalayas! 🏔️ Its top is always covered in snow.
g Duniya ka sabse ooncha pahaad Mount Everest hai, jo Himalaya mein hai! 🏔️ Uski choti par hamesha barf rehti hai.
@ganga गंगा,=ganga,ganges
h गंगा भारत की सबसे लंबी नदी है, जो हिमालय से निकलकर समुद्र तक जाती है! 🏞️ उसमें प्यारी गंगा डॉल्फ़िन भी रहती हैं।
e The Ganga is India's longest river — it flows from the Himalayas all the way to the sea! 🏞️ Lovely Ganga river dolphins live in it.
g Ganga Bharat ki sabse lambi nadi hai, jo Himalaya se nikalkar samudra tak jaati hai! 🏞️ Usmein pyaari Ganga dolphin bhi rehti hain.
@india_rivers नदी,नदियां,नदियों,river,rivers,=nadi,nadiyan + $INDIA
h भारत में बहुत सारी नदियाँ हैं — गंगा, यमुना, ब्रह्मपुत्र, गोदावरी, कृष्णा, कावेरी और नर्मदा! 🏞️ नदियाँ खेतों को पानी देती हैं।
e India has many rivers — the Ganga, Yamuna, Brahmaputra, Godavari, Krishna, Kaveri and Narmada! 🏞️ Rivers bring water to the fields.
g Bharat mein bahut saari nadiyaan hain — Ganga, Yamuna, Brahmaputra, Godavari, Krishna, Kaveri aur Narmada! 🏞️ Nadiyaan kheton ko paani deti hain.
@taj_mahal ताजमहल,ताज महल,taj mahal,tajmahal
h ताजमहल आगरा में सफ़ेद संगमरमर से बनी एक बहुत सुंदर इमारत है! 🕌 दुनिया भर से लोग उसे देखने आते हैं।
e The Taj Mahal is a beautiful white marble building in Agra! 🕌 People come from all over the world to see it.
g Taj Mahal Agra mein safed sangmarmar se bani ek bahut sundar imaarat hai! 🕌 Duniya bhar se log use dekhne aate hain.
@chandrayaan चंद्रयान,इसरो,मंगलयान,chandrayaan,chandrayan,=isro,mangalyaan,mangalyan
h चंद्रयान भारत का चाँद पर भेजा गया यान है — 2023 में चंद्रयान-3 चाँद के दक्षिणी ध्रुव के पास उतरा! 🚀 इसे इसरो के वैज्ञानिकों ने बनाया।
e Chandrayaan is India's mission to the moon — in 2023, Chandrayaan-3 landed near the moon's south pole! 🚀 ISRO's scientists built it.
g Chandrayaan Bharat ka chaand par bheja gaya yaan hai — 2023 mein Chandrayaan-3 chaand ke dakshini dhruv ke paas utra! 🚀 Ise ISRO ke vaigyanikon ne banaya.
@festivals त्योहार,त्यौहार,festival,festivals,tyohar,tyohaar,tyohaaron + $CUE
h भारत में बहुत सारे त्योहार हैं — दिवाली, होली, ईद, क्रिसमस, गुरपुरब, पोंगल, ओणम और भी बहुत! 🎉 सब मिलकर खुशियाँ बाँटते हैं।
e India has so many festivals — Diwali, Holi, Eid, Christmas, Gurpurab, Pongal, Onam and more! 🎉 Everyone shares the happiness together.
g Bharat mein bahut saare tyohaar hain — Diwali, Holi, Eid, Christmas, Gurpurab, Pongal, Onam aur bhi bahut! 🎉 Sab milkar khushiyan baant-te hain.
@diwali दिवाली,दीवाली,दीपावली,diwali,deepawali,divali,deepavali
h दिवाली रोशनी का त्योहार है — लोग दीये जलाते हैं, घर सजाते हैं और मिठाइयाँ बाँटते हैं! 🪔 पटाखों से दूर रहना, और डरने वाले जानवरों का भी ध्यान रखना।
e Diwali is the festival of lights — people light diyas, decorate homes and share sweets! 🪔 Stay away from firecrackers, and be kind to animals who get scared of loud noise.
g Diwali roshni ka tyohaar hai — log diye jalaate hain, ghar sajaate hain aur mithaiyan baant-te hain! 🪔 Pataakhon se door rehna, aur darne wale jaanwaron ka bhi dhyan rakhna.
@holi होली,=holi
h होली रंगों का त्योहार है — लोग एक-दूसरे को प्यार से रंग लगाते हैं और गुजिया खाते हैं! 🎨 रंग आँखों में न जाए, इसका ध्यान रखना।
e Holi is the festival of colours — people put colours on each other and eat gujiya! 🎨 Be careful to keep colours out of your eyes.
g Holi rangon ka tyohaar hai — log ek-doosre ko pyaar se rang lagaate hain aur gujiya khaate hain! 🎨 Rang aankhon mein na jaaye, iska dhyan rakhna.
@eid =ईद,=eid,eid mubarak,ईद मुबारक,=id mubarak
h ईद खुशियों का त्योहार है — लोग नए कपड़े पहनते हैं, गले मिलते हैं और मीठी सेवइयाँ बाँटते हैं! 🌙 ईद मुबारक कहकर सबको शुभकामनाएँ देते हैं।
e Eid is a happy festival — people wear new clothes, hug each other and share sweet sevaiyan! 🌙 They wish everyone Eid Mubarak.
g Eid khushiyon ka tyohaar hai — log naye kapde pehente hain, gale milte hain aur meethi sevaiyan baant-te hain! 🌙 Eid Mubarak kehkar sabko shubhkaamnaayein dete hain.
@christmas क्रिसमस,christmas,=xmas,krismas
h क्रिसमस 25 दिसंबर को मनाया जाता है — लोग पेड़ सजाते हैं, केक खाते हैं और तोहफ़े देते हैं! 🎄 सांता क्लॉज़ की कहानियाँ भी बहुत मज़ेदार हैं।
e Christmas is on 25 December — people decorate a tree, eat cake and give presents! 🎄 Stories about Santa Claus are fun too.
g Christmas 25 December ko manaaya jaata hai — log ped sajaate hain, cake khaate hain aur tohfe dete hain! 🎄 Santa Claus ki kahaniyan bhi bahut mazedaar hain.
@gurpurab गुरपुरब,गुरुपर्व,गुरु नानक जयंती,gurpurab,gurupurab,guru nanak jayanti
h गुरपुरब पर लोग गुरुद्वारे जाते हैं, कीर्तन सुनते हैं और लंगर में सब साथ बैठकर खाना खाते हैं! 🙏 लंगर सिखाता है कि सब बराबर हैं।
e On Gurpurab, people visit the gurdwara, listen to hymns and share a meal together at the langar! 🙏 Langar teaches that everyone is equal.
g Gurpurab par log gurudwaare jaate hain, keertan sunte hain aur langar mein sab saath baithkar khaana khaate hain! 🙏 Langar sikhaata hai ki sab baraabar hain.
@rakhi रक्षाबंधन,रक्षा बंधन,राखी,raksha bandhan,rakshabandhan,=rakhi
h रक्षाबंधन पर बहनें भाइयों को राखी बाँधती हैं, और सब एक-दूसरे का ध्यान रखने का वादा करते हैं! 🧵 मिठाई भी खूब खाई जाती है।
e On Raksha Bandhan, sisters tie a rakhi on their brothers' wrists, and everyone promises to look after each other! 🧵 And there are lots of sweets.
g Rakshabandhan par behnein bhaiyon ko rakhi baandhti hain, aur sab ek-doosre ka dhyan rakhne ka vaada karte hain! 🧵 Mithai bhi khoob khaayi jaati hai.
@harvest_festivals मकर संक्रांति,संक्रांति,पोंगल,लोहडी,बिहू,उत्तरायण,makar sankranti,sankranti,pongal,lohri,=bihu,uttarayan
h मकर संक्रांति, पोंगल, लोहड़ी और बिहू फसल के त्योहार हैं — नई फसल की खुशी में मनाए जाते हैं! 🪁 कहीं पतंगें उड़ती हैं, तो कहीं मीठा पोंगल और तिल-गुड़ बनता है।
e Makar Sankranti, Pongal, Lohri and Bihu are harvest festivals — they celebrate the new crops! 🪁 Some places fly kites, others cook sweet pongal or til-gud.
g Makar Sankranti, Pongal, Lohri aur Bihu fasal ke tyohaar hain — nayi fasal ki khushi mein manaaye jaate hain! 🪁 Kahin patangein udti hain, toh kahin meetha pongal aur til-gud banta hai.
@onam ओणम,=onam
h ओणम केरल का फसल का त्योहार है — लोग फूलों से सुंदर रंगोली बनाते हैं, जिसे पूकलम कहते हैं! 🌼 नाव दौड़ और केले के पत्ते पर खाना भी होता है।
e Onam is Kerala's harvest festival — people make beautiful flower rangolis called pookalam! 🌼 There are boat races and meals on banana leaves too.
g Onam Kerala ka fasal ka tyohaar hai — log phoolon se sundar rangoli banaate hain, jise pookalam kehte hain! 🌼 Naav daud aur kele ke patte par khaana bhi hota hai.
@navratri नवरात्रि,नवरात्र,दुर्गा पूजा,गरबा,डांडिया,दशहरा,navratri,navaratri,durga puja,garba,dandiya,dussehra,dussera
h नवरात्रि में नौ रातों तक लोग गरबा और डांडिया नाचते हैं, और कई जगह दुर्गा पूजा के सुंदर पंडाल सजते हैं! 💃 दशहरे पर अच्छाई की जीत का उत्सव मनाते हैं।
e During Navratri, people dance garba and dandiya for nine nights, and many places set up beautiful Durga Puja pandals! 💃 Dussehra celebrates good winning over bad.
g Navratri mein nau raaton tak log garba aur dandiya naachte hain, aur kai jagah Durga Puja ke sundar pandaal sajte hain! 💃 Dussehre par achhaai ki jeet ka utsav manaate hain.
@ganesh_chaturthi गणेश चतुर्थी,गणपति,गणेशोत्सव,ganesh chaturthi,ganpati,ganapati,ganesh utsav
h गणेश चतुर्थी पर लोग गणपति की मूर्ति घर लाते हैं, सजाते हैं और मोदक चढ़ाते हैं! 🐘 महाराष्ट्र में ये बहुत धूमधाम से मनाया जाता है।
e On Ganesh Chaturthi, people bring home a Ganpati idol, decorate it and offer modaks! 🐘 It's celebrated with great joy in Maharashtra.
g Ganesh Chaturthi par log Ganpati ki moorti ghar laate hain, sajaate hain aur modak chadhaate hain! 🐘 Maharashtra mein yeh bahut dhoomdhaam se manaaya jaata hai.
@baisakhi बैसाखी,वैसाखी,baisakhi,vaisakhi
h बैसाखी पंजाब का फसल का त्योहार है — लोग भांगड़ा और गिद्धा नाचकर खुशी मनाते हैं! 🌾 गुरुद्वारों में भी इस दिन खास उत्सव होता है।
e Baisakhi is Punjab's harvest festival — people dance bhangra and giddha to celebrate! 🌾 Gurdwaras hold special celebrations that day too.
g Baisakhi Punjab ka fasal ka tyohaar hai — log bhangra aur giddha naachkar khushi manaate hain! 🌾 Gurudwaaron mein bhi is din khaas utsav hota hai.
@chhath =छठ,छठ पूजा,chhath,chhath puja,chath puja
h छठ पूजा में लोग नदी या तालाब के किनारे उगते और डूबते सूरज को धन्यवाद देते हैं! ☀️ ये बिहार और उत्तर प्रदेश में खूब मनाया जाता है।
e During Chhath Puja, people thank the rising and setting sun at rivers and ponds! ☀️ It's celebrated a lot in Bihar and Uttar Pradesh.
g Chhath Puja mein log nadi ya taalaab ke kinaare ugte aur doobte suraj ko dhanyavaad dete hain! ☀️ Yeh Bihar aur Uttar Pradesh mein khoob manaaya jaata hai.
@buddha_purnima बुद्ध पूर्णिमा,बुद्ध जयंती,buddha purnima,buddha jayanti,vesak
h बुद्ध पूर्णिमा पर लोग भगवान बुद्ध की शांति और दया की सीख याद करते हैं! 🪷 इस दिन दीये जलाकर और दूसरों की मदद करके मनाते हैं।
e On Buddha Purnima, people remember the Buddha's lessons of peace and kindness! 🪷 They light lamps and help others.
g Buddha Purnima par log Bhagwan Buddh ki shaanti aur daya ki seekh yaad karte hain! 🪷 Is din diye jalaakar aur doosron ki madad karke manaate hain.
@mahavir_jayanti महावीर जयंती,mahavir jayanti,mahaveer jayanti
h महावीर जयंती पर लोग भगवान महावीर की सीख याद करते हैं — किसी भी जीव को दुख मत दो! 🙏 इस दिन लोग दान और सेवा करते हैं।
e On Mahavir Jayanti, people remember Lord Mahavira's lesson — never hurt any living being! 🙏 People share and help others that day.
g Mahavir Jayanti par log Bhagwan Mahavir ki seekh yaad karte hain — kisi bhi jeev ko dukh mat do! 🙏 Is din log daan aur seva karte hain.
@janmashtami जन्माष्टमी,दही हांडी,janmashtami,janmashtmi,dahi handi
h जन्माष्टमी पर लोग कान्हा का जन्मदिन मनाते हैं — झाँकियाँ सजती हैं और कई जगह दही-हांडी फोड़ी जाती है! 🪈 माखन-मिश्री भी खूब बँटती है।
e On Janmashtami, people celebrate little Krishna's birthday — with decorations, and dahi handi in many places! 🪈 Butter and sugar treats are shared.
g Janmashtami par log Kanha ka janmdin manaate hain — jhaankiyan sajti hain aur kai jagah dahi-handi phodi jaati hai! 🪈 Makhan-mishri bhi khoob bant-ti hai.
@independence_day स्वतंत्रता दिवस,आजादी का दिन,15 अगस्त,पंद्रह अगस्त,independence day,15 august,swatantrata diwas,azadi ka din
h 15 अगस्त को स्वतंत्रता दिवस होता है, जब 1947 में भारत आज़ाद हुआ था! 🇮🇳 उस दिन झंडा फहराते हैं और देशभक्ति के गीत गाते हैं।
e Independence Day is on 15 August — India became free in 1947! 🇮🇳 We raise the flag and sing songs for our country.
g 15 August ko Swatantrata Diwas hota hai, jab 1947 mein Bharat aazaad hua tha! 🇮🇳 Us din jhanda phehraate hain aur deshbhakti ke geet gaate hain.
@republic_day गणतंत्र दिवस,26 जनवरी,छब्बीस जनवरी,republic day,26 january,gantantra diwas
h 26 जनवरी को गणतंत्र दिवस होता है, जब 1950 में हमारा संविधान लागू हुआ! 🇮🇳 दिल्ली में शानदार परेड होती है।
e Republic Day is on 26 January — our Constitution began in 1950! 🇮🇳 There's a grand parade in Delhi.
g 26 January ko Gantantra Diwas hota hai, jab 1950 mein hamara samvidhaan laagu hua! 🇮🇳 Dilli mein shaandaar parade hoti hai.
@childrens_day बाल दिवस,14 नवंबर,childrens day,children day,bal diwas,baal diwas
h 14 नवंबर को बाल दिवस मनाया जाता है — ये बच्चों का खास दिन है! 🎈 ये चाचा नेहरू का जन्मदिन है, जिन्हें बच्चों से बहुत प्यार था।
e Children's Day is on 14 November — a special day for children! 🎈 It's the birthday of Chacha Nehru, who loved children very much.
g 14 November ko Baal Diwas manaaya jaata hai — yeh bachchon ka khaas din hai! 🎈 Yeh Chacha Nehru ka janmdin hai, jinhe bachchon se bahut pyaar tha.
@gandhi गांधी,बापू,महात्मा,gandhi,=bapu,mahatma,gandhi jayanti
h महात्मा गांधी को प्यार से बापू कहते हैं — उन्होंने सच और अहिंसा के रास्ते से देश की आज़ादी में मदद की! 🕊️ 2 अक्टूबर को उनका जन्मदिन गांधी जयंती के रूप में मनाते हैं।
e Mahatma Gandhi is lovingly called Bapu — he helped India become free through truth and peace! 🕊️ His birthday, 2 October, is celebrated as Gandhi Jayanti.
g Mahatma Gandhi ko pyaar se Bapu kehte hain — unhone sach aur ahinsa ke raaste se desh ki aazaadi mein madad ki! 🕊️ 2 October ko unka janmdin Gandhi Jayanti ke roop mein manaate hain.
@teachers_day शिक्षक दिवस,टीचर्स डे,teachers day,teacher day,shikshak diwas
h 5 सितंबर को शिक्षक दिवस होता है, जब हम अपने टीचरों को धन्यवाद कहते हैं! 🍎 ये सर्वपल्ली राधाकृष्णन जी का जन्मदिन है, जो खुद एक महान शिक्षक थे।
e Teachers' Day is on 5 September, when we say thank you to our teachers! 🍎 It's the birthday of Sarvepalli Radhakrishnan, a great teacher.
g 5 September ko Shikshak Diwas hota hai, jab hum apne teacheron ko dhanyavaad kehte hain! 🍎 Yeh Sarvepalli Radhakrishnan ji ka janmdin hai, jo khud ek mahaan shikshak the.
`);

  macro("WORK", "$HOW,काम,चलता,चलती,=work,works,=run,runs,kaam,chalta,chalti");

  def("science", `
@robot ? रोबोट,robot,robots,=robo
h रोबोट एक मशीन है जो कंप्यूटर की बताई बातों से काम करती है — जैसे सफ़ाई करना या चीज़ें उठाना! 🤖 रोबोट को इंसान बनाते और सिखाते हैं।
e A robot is a machine that does jobs using instructions from a computer — like cleaning or lifting things! 🤖 People build robots and teach them.
g Robot ek machine hai jo computer ki bataayi baaton se kaam karti hai — jaise safaai karna ya cheezein uthaana! 🤖 Robot ko insaan banaate aur sikhaate hain.
@computer ? कंप्यूटर,लैपटॉप,computer,computers,laptop
h कंप्यूटर एक मशीन है जो हमारी बताई बातें सीखता है और बहुत तेज़ी से हिसाब लगाता है! 💻 उससे लिखना, चित्र बनाना और खेल खेलना हो सकता है।
e A computer is a machine that learns what we tell it and works things out super fast! 💻 We can write, draw and play games on it.
g Computer ek machine hai jo hamari bataayi baatein seekhta hai aur bahut tezi se hisaab lagaata hai! 💻 Usse likhna, chitra banaana aur khel khelna ho sakta hai.
@ai ? एआई,आर्टिफिशियल,कृत्रिम बुद्धि,=ai,artificial intelligence
h एआई ऐसा कंप्यूटर है जो ढेर सारी बातें पढ़कर जवाब देना सीखता है — कंप्यूटर हमारी बताई बातें सीखता है! 🧠 वो कभी-कभी गलती भी करता है, इसलिए बड़ों से पूछना अच्छा है।
e AI is a computer that learns to answer by reading lots and lots of things — computers learn what people teach them! 🧠 It sometimes makes mistakes, so it's good to check with a grown-up.
g AI aisa computer hai jo dher saari baatein padhkar jawaab dena seekhta hai — computer hamari bataayi baatein seekhta hai! 🧠 Woh kabhi-kabhi galti bhi karta hai, isliye badon se poochhna achha hai.
@internet ? इंटरनेट,वाईफाई,internet,wifi,=wi fi
h इंटरनेट दुनिया भर के कंप्यूटरों और फ़ोनों को आपस में जोड़ता है, जैसे सड़कें शहरों को जोड़ती हैं! 🌐 इंटरनेट हमेशा बड़ों के साथ ही इस्तेमाल करना।
e The internet connects computers and phones all over the world, like roads connect cities! 🌐 Always use the internet with a grown-up.
g Internet duniya bhar ke computeron aur phonon ko aapas mein jodta hai, jaise sadkein shehron ko jodti hain! 🌐 Internet hamesha badon ke saath hi istemaal karna.
@phone फोन,मोबाइल,=phone,phones,mobile + $WORK
h फ़ोन हमारी आवाज़ को अनदेखी तरंगों में बदलकर दूर भेज देता है, और दूसरा फ़ोन उसे फिर से आवाज़ बना देता है! 📱 कमाल है ना?
e A phone turns your voice into invisible waves and sends them far away, and the other phone turns them back into your voice! 📱 Amazing, right?
g Phone hamari awaaz ko andekhi tarangon mein badalkar door bhej deta hai, aur doosra phone use phir se awaaz bana deta hai! 📱 Kamaal hai na?
@tv टीवी,टेलीविजन,=tv,television + $WORK,$WHAT
h टीवी बहुत सारी तस्वीरें बहुत तेज़ी से एक के बाद एक दिखाता है, जिससे सब चलता हुआ लगता है! 📺 बहुत देर टीवी देखने से आँखें थक जाती हैं।
e A TV shows lots of pictures very quickly, one after another, so everything looks like it's moving! 📺 Watching too long makes our eyes tired.
g TV bahut saari tasveerein bahut tezi se ek ke baad ek dikhaata hai, jisse sab chalta hua lagta hai! 📺 Bahut der TV dekhne se aankhein thak jaati hain.
@rocket ? रॉकेट,rocket,rockets,raket
h रॉकेट नीचे से बहुत ज़ोर से गर्म गैस निकालता है, जिससे वो ऊपर अंतरिक्ष की ओर उड़ता है! 🚀 जैसे गुब्बारे की हवा छोड़ो तो वो भागता है।
e A rocket pushes hot gas out of the bottom very hard, and that shoots it up into space! 🚀 Like a balloon zooming when you let the air out.
g Rocket neeche se bahut zor se garam gas nikaalta hai, jisse woh upar antariksh ki or udta hai! 🚀 Jaise gubbaare ki hawa chhodo toh woh bhaagta hai.
@space ? अंतरिक्ष,ब्रह्मांड,outer space,=space,universe,antariksh,brahmand
h अंतरिक्ष वो बहुत बड़ी जगह है जहाँ सूरज, चाँद, तारे और ग्रह हैं! 🌌 वहाँ साँस लेने वाली हवा नहीं होती, और चीज़ें तैरती हैं।
e Space is the huge place where the sun, moon, stars and planets are! 🌌 There's no air to breathe there, and things float.
g Antariksh woh bahut badi jagah hai jahan suraj, chaand, taare aur grah hain! 🌌 Wahan saans lene wali hawa nahi hoti, aur cheezein tairti hain.
@astronaut अंतरिक्ष यात्री,astronaut,astronauts,antariksh yatri + $Q,$DO
h अंतरिक्ष यात्री रॉकेट से अंतरिक्ष में जाते हैं और वहाँ प्रयोग करते हैं! 👩‍🚀 वो वहाँ तैरते हुए खाते और सोते हैं — भारत के राकेश शर्मा भी अंतरिक्ष गए थे।
e Astronauts travel to space in rockets and do experiments there! 👩‍🚀 They eat and sleep while floating — India's Rakesh Sharma went to space too.
g Astronaut rocket se antariksh mein jaate hain aur wahan prayog karte hain! 👩‍🚀 Woh wahan tairte hue khaate aur sote hain — Bharat ke Rakesh Sharma bhi antariksh gaye the.
@planets ग्रह,ग्रहों,planet,planets,=grah + $MANY,$WHAT,$TELL,नाम,names
h हमारे सूरज के चारों ओर आठ ग्रह घूमते हैं — बुध, शुक्र, पृथ्वी, मंगल, बृहस्पति, शनि, अरुण और वरुण! 🪐 हमारी पृथ्वी उनमें से एक है।
e Eight planets go around our sun — Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune! 🪐 Our Earth is one of them.
g Hamare suraj ke chaaron or aath grah ghoomte hain — Budh, Shukra, Prithvi, Mangal, Brihaspati, Shani, Arun aur Varun! 🪐 Hamari Prithvi unmein se ek hai.
@venus ? =शुक्र,शुक्र ग्रह,venus,=shukra
h शुक्र सबसे गर्म ग्रह है, और सुबह-शाम आसमान में सबसे चमकीला दिखता है! ✨ इसे भोर का तारा भी कहते हैं।
e Venus is the hottest planet, and it shines brightly in the morning or evening sky! ✨ People call it the morning star.
g Shukra sabse garam grah hai, aur subah-shaam aasmaan mein sabse chamkeela dikhta hai! ✨ Ise bhor ka taara bhi kehte hain.
@mars ? =मंगल,मंगल ग्रह,=mars,=mangal
h मंगल को लाल ग्रह कहते हैं, क्योंकि उसकी मिट्टी लाल है! 🔴 भारत का मंगलयान भी मंगल तक पहुँचा था।
e Mars is called the red planet because its soil is red! 🔴 India's Mangalyaan reached Mars too.
g Mangal ko laal grah kehte hain, kyunki uski mitti laal hai! 🔴 Bharat ka Mangalyaan bhi Mangal tak pahuncha tha.
@jupiter ? बृहस्पति,गुरु ग्रह,jupiter,brihaspati
h बृहस्पति सबसे बड़ा ग्रह है — उसमें हज़ार से ज़्यादा पृथ्वियाँ समा सकती हैं! 🪐 उस पर एक बहुत बड़ा तूफ़ानी धब्बा है।
e Jupiter is the biggest planet — more than a thousand Earths could fit inside it! 🪐 It has a giant storm spot.
g Brihaspati sabse bada grah hai — usmein hazaar se zyada prithviyan sama sakti hain! 🪐 Us par ek bahut bada toofaani dhabba hai.
@saturn ? =शनि,शनि ग्रह,saturn,=shani
h शनि ग्रह के चारों ओर सुंदर छल्ले हैं, जो बर्फ़ और पत्थर के टुकड़ों से बने हैं! 🪐 वो बहुत बड़ा और बहुत दूर है।
e Saturn has beautiful rings made of ice and rock pieces! 🪐 It's very big and very far away.
g Shani grah ke chaaron or sundar chhalle hain, jo barf aur patthar ke tukdon se bane hain! 🪐 Woh bahut bada aur bahut door hai.
@far_planets ? यूरेनस,नेपच्यून,अरुण ग्रह,वरुण ग्रह,uranus,neptune
h यूरेनस और नेपच्यून सबसे दूर के ठंडे, नीले ग्रह हैं! 🔵 वहाँ इतनी ठंड है कि हम सोच भी नहीं सकते।
e Uranus and Neptune are the farthest, coldest blue planets! 🔵 They're colder than we can imagine.
g Uranus aur Neptune sabse door ke thande, neele grah hain! 🔵 Wahan itni thand hai ki hum soch bhi nahi sakte.
@electricity बिजली,electricity,=current,=bijli + कहां से,$HOW,$WHAT,आती,बनती,=from,comes,=made,aati,banti
h बिजली बड़े बिजलीघरों में बनती है — पानी, हवा, धूप या कोयले से — और तारों से हमारे घर आती है! 💡 उसी से पंखे, बल्ब और फ़्रिज चलते हैं।
e Electricity is made in big power stations — from water, wind, sunshine or coal — and comes to our homes through wires! 💡 It runs fans, bulbs and fridges.
g Bijli bade bijlighar mein banti hai — paani, hawa, dhoop ya koyle se — aur taaron se hamare ghar aati hai! 💡 Usi se pankhe, bulb aur fridge chalte hain.
@bulb बल्ब,ट्यूबलाइट,=bulb,bulbs,tubelight,=lamp + $WORK,$WHY,जलता,=glow,jalta
h बल्ब में बिजली जाती है, तो वो चमककर रोशनी देता है! 💡 कमरे से बाहर जाओ तो लाइट बंद करना — बिजली बचती है।
e When electricity flows into a bulb, it glows and gives light! 💡 Switch off the light when you leave a room — it saves electricity.
g Bulb mein bijli jaati hai, toh woh chamakkar roshni deta hai! 💡 Kamre se bahar jao toh light band karna — bijli bachti hai.
@solar सोलर,सौर ऊर्जा,सौर,solar,solar panel,solar power,saur urja
h सोलर पैनल धूप को पकड़कर बिजली बना देते हैं! ☀️ सूरज की ऊर्जा कभी खत्म नहीं होती और हवा भी साफ़ रहती है।
e Solar panels catch sunshine and turn it into electricity! ☀️ Sunshine never runs out, and it keeps the air clean.
g Solar panel dhoop ko pakadkar bijli bana dete hain! ☀️ Suraj ki oorja kabhi khatam nahi hoti aur hawa bhi saaf rehti hai.
@windmill पवनचक्की,विंड टरबाइन,windmill,windmills,wind turbine,pawan chakki,pawanchakki
h पवनचक्की के बड़े पंखे हवा से घूमते हैं और बिजली बनाते हैं! 🌬️ ये साफ़ बिजली है, इसमें धुआँ नहीं होता।
e A wind turbine's big blades spin in the wind and make electricity! 🌬️ It's clean power with no smoke.
g Pawanchakki ke bade pankhe hawa se ghoomte hain aur bijli banaate hain! 🌬️ Yeh saaf bijli hai, ismein dhuaan nahi hota.
@recycling रीसायकल,रिसायकल,पुनर्चक्रण,recycle,recycling,recycled,reuse
h रीसायकल का मतलब है पुरानी चीज़ों से नई चीज़ें बनाना — जैसे पुराने कागज़ से नया कागज़! ♻️ कचरा अलग-अलग डिब्बों में डालना इसमें मदद करता है।
e Recycling means making new things from old things — like new paper from old paper! ♻️ Sorting rubbish into different bins helps.
g Recycle ka matlab hai puraani cheezon se nayi cheezein banaana — jaise puraane kaagaz se naya kaagaz! ♻️ Kachra alag-alag dibbon mein daalna ismein madad karta hai.
@save_water पानी बचा,पानी क्यों बचा,पानी बर्बाद,save water,saving water,waste water,paani bacha,pani bacha,paani barbaad
h पीने लायक साफ़ पानी बहुत कम है, इसलिए हर बूँद कीमती है! 💧 ब्रश करते समय नल बंद रखो — ये सबसे आसान तरीका है।
e There's only a little clean water to drink, so every drop is precious! 💧 Turn off the tap while you brush — it's the easiest way to help.
g Peene laayak saaf paani bahut kam hai, isliye har boond keemti hai! 💧 Brush karte samay nal band rakho — yeh sabse aasaan tareeka hai.
@save_power बिजली बचा,बिजली क्यों बचा,save electricity,save power,saving electricity,bijli bacha
h बिजली बचाने से धरती की हवा साफ़ रहती है! 💡 कमरे से निकलो तो पंखा और लाइट बंद करना।
e Saving electricity helps keep the Earth's air clean! 💡 Switch off the fan and light when you leave a room.
g Bijli bachaane se dharti ki hawa saaf rehti hai! 💡 Kamre se niklo toh pankha aur light band karna.
@plastic प्लास्टिक,पॉलिथीन,पन्नी,plastic,plastics,polythene,plastic bag + $Q,=bad,बुरा,नुकसान
h प्लास्टिक बहुत सालों तक गलता नहीं, और नदियों-समुद्र में जानवरों को नुकसान पहुँचाता है! 🐢 इसलिए कपड़े का थैला ले जाना अच्छा है।
e Plastic takes hundreds of years to break down, and it can harm animals in rivers and seas! 🐢 That's why cloth bags are great.
g Plastic bahut saalon tak galta nahi, aur nadiyon-samudra mein jaanwaron ko nuksaan pahunchaata hai! 🐢 Isliye kapde ka thaila le jaana achha hai.
@pollution प्रदूषण,धुआं,धुएं,pollution,=smoke,smog,pradushan,dhuan + $Q
h गाड़ियों और फ़ैक्टरियों का धुआँ हवा को गंदा कर देता है, इसे प्रदूषण कहते हैं! 🌫️ पेड़ लगाना और पैदल या साइकिल से चलना हवा को साफ़ रखने में मदद करता है।
e Smoke from cars and factories makes the air dirty — that's pollution! 🌫️ Planting trees and walking or cycling help keep the air clean.
g Gaadiyon aur factoriyon ka dhuaan hawa ko ganda kar deta hai, ise pradushan kehte hain! 🌫️ Ped lagaana aur paidal ya cycle se chalna hawa ko saaf rakhne mein madad karta hai.
@magnet चुंबक,चुम्बक,magnet,magnets,magnetic,chumbak
h चुंबक लोहे की चीज़ों को अपनी ओर खींच लेता है, जैसे जादू! 🧲 फ़्रिज पर चिपके खिलौने भी चुंबक से चिपकते हैं।
e A magnet pulls iron things towards it, like magic! 🧲 Fridge magnets stick because of it.
g Chumbak lohe ki cheezon ko apni or kheench leta hai, jaise jaadu! 🧲 Fridge par chipke khilaune bhi chumbak se chipakte hain.
@ice बर्फ,=ice,=barf,=baraf + पिघल,जमता,जमती,बनती,बनता,melt,melts,melting,freeze,freezes,=made,pighal,jamta,banti,banta,$HOW,$WHY
h पानी को बहुत ठंडा करो तो वो जमकर बर्फ़ बन जाता है, और गर्मी मिलते ही बर्फ़ फिर पानी बन जाती है! 🧊 पानी, बर्फ़ और भाप — तीनों एक ही चीज़ के रूप हैं।
e When water gets very cold, it freezes into ice, and when it warms up, the ice melts back into water! 🧊 Water, ice and steam are the same thing in different forms.
g Paani ko bahut thanda karo toh woh jamkar barf ban jaata hai, aur garmi milte hi barf phir paani ban jaati hai! 🧊 Paani, barf aur bhaap — teenon ek hi cheez ke roop hain.
@steam भाप,उबल,उबाल,steam,=boil,boils,boiling,bhaap,ubal,ubaal
h पानी को बहुत गर्म करो तो वो उबलकर भाप बन जाता है और हवा में उड़ जाता है! ♨️ भाप बहुत गर्म होती है, उससे दूर रहना।
e When water gets very hot, it boils and turns into steam that floats into the air! ♨️ Steam is very hot, so stay away from it.
g Paani ko bahut garam karo toh woh ubalkar bhaap ban jaata hai aur hawa mein ud jaata hai! ♨️ Bhaap bahut garam hoti hai, usse door rehna.
@float_sink तैरती,तैरता,तैरते,डूबती,डूबता,डूबते,float,floats,floating,sink,sinks,sinking,tairti,tairta,tairte,dubti,dubta,dubte + $WHY,$HOW,कुछ चीजें,चीजें,things,=cheezein,=kuch
h हल्की और हवा भरी चीज़ें पानी पर तैरती हैं, जैसे पत्ता या गेंद! 🛶 भारी और ठोस चीज़ें, जैसे पत्थर, डूब जाती हैं — बड़ों के साथ एक कटोरे में आज़माकर देखो।
e Light things filled with air float, like a leaf or a ball! 🛶 Heavy, solid things like stones sink — try it in a bowl of water with a grown-up.
g Halki aur hawa bhari cheezein paani par tairti hain, jaise patta ya gend! 🛶 Bhaari aur thos cheezein, jaise patthar, doob jaati hain — badon ke saath ek katore mein aazmaakar dekho.
@boat नाव,जहाज,boat,boats,=ship,ships,naav,=nav,jahaj,jahaaz + तैर,डूब,float,floats,sink,=tair,$HOW,$WHY
h नाव और जहाज़ का आकार ऐसा होता है कि वो बहुत सारा पानी हटा देते हैं, और पानी उन्हें ऊपर धकेलता है! ⛵ इसलिए भारी जहाज़ भी तैरता है।
e Boats and ships are shaped to push lots of water aside, and the water pushes them back up! ⛵ That's why even a huge ship floats.
g Naav aur jahaaz ka aakaar aisa hota hai ki woh bahut saara paani hata dete hain, aur paani unhe upar dhakelta hai! ⛵ Isliye bhaari jahaaz bhi tairta hai.
@airplane हवाई जहाज,हवाईजहाज,विमान,plane,planes,aeroplane,airplane,jet,hawai jahaj,havai jahaj,vimaan + उड,उडता,उडते,fly,flies,flying,udta,udte,$HOW,$WHY
h हवाई जहाज़ के पंख ऐसे बने होते हैं कि तेज़ दौड़ने पर हवा उन्हें ऊपर उठा देती है! ✈️ उसके बड़े इंजन उसे आगे धकेलते हैं।
e An aeroplane's wings are shaped so that when it races along, the air lifts it up! ✈️ Its big engines push it forward.
g Hawai jahaaz ke pankh aise bane hote hain ki tez daudne par hawa unhe upar utha deti hai! ✈️ Uske bade engine use aage dhakelte hain.
@train रेल,ट्रेन,रेलगाडी,=train,trains,=rail,railgadi + $WORK,$WHY,पटरी,track,patri
h रेलगाड़ी लोहे की पटरियों पर चलती है, और उसका इंजन सारे डिब्बों को खींचता है! 🚂 भारत में रोज़ लाखों लोग ट्रेन से सफ़र करते हैं।
e Trains run on iron tracks, and the engine pulls all the coaches! 🚂 Millions of people travel by train in India every day.
g Railgaadi lohe ki patriyon par chalti hai, aur uska engine saare dibbon ko kheenchta hai! 🚂 Bharat mein roz laakhon log train se safar karte hain.
@car कार,गाडी,=car,cars,gaadi,=gadi + $WORK
h गाड़ी का इंजन पेट्रोल, डीज़ल, गैस या बिजली से ताक़त लेकर पहियों को घुमाता है! 🚗 बिजली वाली गाड़ियाँ हवा को साफ़ रखने में मदद करती हैं।
e A car's engine uses petrol, diesel, gas or electricity to turn the wheels! 🚗 Electric cars help keep the air clean.
g Gaadi ka engine petrol, diesel, gas ya bijli se taakat lekar pahiyon ko ghumata hai! 🚗 Bijli wali gaadiyan hawa ko saaf rakhne mein madad karti hain.
@bicycle साइकिल,cycle,bicycle,=bike,cycling + $HOW,सीखूं,सीखना,=learn,chalana,चलाना,balance
h साइकिल पैडल मारने से चलती है, और संतुलन बनाने से हम गिरते नहीं! 🚲 हेलमेट पहनकर, बड़ों के साथ सीखना सबसे अच्छा है।
e A bicycle moves when you pedal, and balancing keeps you from falling! 🚲 Learn with a helmet on and a grown-up beside you.
g Cycle pedal maarne se chalti hai, aur santulan banaane se hum girte nahi! 🚲 Helmet pehenkar, badon ke saath seekhna sabse achha hai.
@balloon गुब्बारा,गुब्बारे,balloon,balloons,gubbara,gubbare + उड,उडता,उडते,=fly,=float,ऊपर,=up,$WHY
h कुछ गुब्बारों में हवा से हल्की गैस भरी होती है, इसलिए वो ऊपर उड़ते हैं! 🎈 मुँह से फुलाए गुब्बारे नीचे ही रहते हैं।
e Some balloons are filled with a gas lighter than air, so they float up! 🎈 Balloons you blow up with your mouth stay down.
g Kuch gubbaaron mein hawa se halki gas bhari hoti hai, isliye woh upar udte hain! 🎈 Munh se phulaaye gubbaare neeche hi rehte hain.
@ball_bounce गेंद,=ball,balls,=gend + उछल,टप्पा,bounce,bounces,bouncing,uchhal,tappa
h गेंद के अंदर हवा भरी होती है, जो ज़मीन से टकराकर उसे वापस उछाल देती है! ⚽ जितनी ज़ोर से फेंको, उतना ऊँचा टप्पा।
e A ball is full of air that springs it back up when it hits the ground! ⚽ The harder you throw, the higher it bounces.
g Gend ke andar hawa bhari hoti hai, jo zameen se takrakar use wapas uchhaal deti hai! ⚽ Jitni zor se phenko, utna ooncha tappa.
@mirror शीशा,शीशे,आईना,दर्पण,mirror,mirrors,sheesha,aaina,darpan
h शीशा रोशनी को वापस लौटा देता है, इसलिए उसमें हमारी शक्ल दिखती है! 🪞 दायाँ हाथ उठाओ, तो शीशे वाला दोस्त बायाँ उठाता दिखेगा।
e A mirror bounces light back, so we can see ourselves in it! 🪞 Raise your right hand, and your mirror friend raises their left.
g Sheesha roshni ko wapas lauta deta hai, isliye usmein hamari shakal dikhti hai! 🪞 Daayaan haath uthao, toh sheeshe wala dost baayaan uthaata dikhega.
@telescope दूरबीन,telescope,telescopes,binoculars,doorbeen
h दूरबीन दूर की चीज़ों को पास और बड़ा दिखाती है! 🔭 वैज्ञानिक बड़ी दूरबीनों से तारे और ग्रह देखते हैं।
e A telescope makes faraway things look close and big! 🔭 Scientists look at stars and planets through giant telescopes.
g Doorbeen door ki cheezon ko paas aur bada dikhaati hai! 🔭 Scientist badi doorbeenon se taare aur grah dekhte hain.
@microscope सूक्ष्मदर्शी,माइक्रोस्कोप,microscope,microscopes
h माइक्रोस्कोप बहुत छोटी चीज़ों को बहुत बड़ा दिखाता है, जैसे कीटाणु! 🔬 वैज्ञानिक उससे नन्ही दुनिया देखते हैं।
e A microscope makes tiny things look huge, like germs! 🔬 Scientists use it to see the teeny-tiny world.
g Microscope bahut chhoti cheezon ko bahut bada dikhaata hai, jaise keetanu! 🔬 Scientist usse nanhi duniya dekhte hain.
@battery बैटरी,सेल,battery,batteries,=cell
h बैटरी के अंदर बिजली जमा रहती है, जिससे खिलौने और फ़ोन चलते हैं! 🔋 बैटरी को कभी मुँह में मत डालना, और मिल जाए तो बड़ों को दे देना।
e A battery stores electricity that runs toys and phones! 🔋 Never put a battery in your mouth — if you find one, give it to a grown-up.
g Battery ke andar bijli jama rehti hai, jisse khilaune aur phone chalte hain! 🔋 Battery ko kabhi munh mein mat daalna, aur mil jaaye toh badon ko de dena.
@sound_travel आवाज,=sound,sounds,avaj,avaaz + $HOW,चलती,पहुंचती,सुनाई,travel,travels,=reach,chalti,pahunchti
h आवाज़ हवा में छोटी-छोटी लहरों की तरह चलकर हमारे कानों तक पहुँचती है! 🔊 जैसे तालाब में कंकड़ डालो तो लहरें फैलती हैं।
e Sound travels through the air in tiny waves until it reaches our ears! 🔊 Like ripples spreading when you drop a pebble in a pond.
g Awaaz hawa mein chhoti-chhoti lehron ki tarah chalkar hamare kaanon tak pahunchti hai! 🔊 Jaise taalaab mein kankad daalo toh lehrein phailti hain.
`);

  def("jobs", `
@job_doctor ? डॉक्टर,डाक्टर,चिकित्सक,doctor,doctors,daktar - दांत,जानवरों,teeth,animal
h डॉक्टर बीमार लोगों की जाँच करते हैं और उन्हें ठीक होने में मदद करते हैं! 🩺 वो हमें सेहतमंद रहना भी सिखाते हैं।
e Doctors check people who are unwell and help them get better! 🩺 They also teach us how to stay healthy.
g Doctor beemaar logon ki jaanch karte hain aur unhe theek hone mein madad karte hain! 🩺 Woh humein sehatmand rehna bhi sikhaate hain.
@job_nurse ? नर्स,nurse,nurses
h नर्स अस्पताल में मरीज़ों का प्यार से ध्यान रखती हैं, और डॉक्टर की मदद करती हैं! 💉 वो बहुत धैर्य वाला काम करती हैं।
e Nurses lovingly look after patients in hospitals and help the doctors! 💉 It's very caring, patient work.
g Nurse aspataal mein mareezon ka pyaar se dhyan rakhti hain, aur doctor ki madad karti hain! 💉 Woh bahut dhairya wala kaam karti hain.
@job_teacher ? टीचर,शिक्षक,अध्यापक,मैडम,teacher,teachers,shikshak,adhyapak
h टीचर हमें पढ़ना, लिखना, गिनना और अच्छी बातें सिखाते हैं! 📚 वो हर बच्चे के सवालों का जवाब देते हैं।
e Teachers help us learn to read, write, count and be kind! 📚 They answer every child's questions.
g Teacher humein padhna, likhna, ginna aur achhi baatein sikhaate hain! 📚 Woh har bachche ke sawaalon ka jawaab dete hain.
@job_police ? पुलिस,सिपाही,police,policeman,policewoman,police officer,=sipahi
h पुलिस वाले लोगों को सुरक्षित रखते हैं और मुसीबत में मदद करते हैं! 👮 खो जाओ तो पुलिस वाले से मदद माँग सकते हो।
e Police officers keep people safe and help when there's trouble! 👮 If you're ever lost, you can ask a police officer for help.
g Police wale logon ko surakshit rakhte hain aur musibat mein madad karte hain! 👮 Kho jao toh police wale se madad maang sakte ho.
@job_firefighter ? फायरमैन,अग्निशामक,दमकल,फायर ब्रिगेड,firefighter,firefighters,fireman,fire brigade,fire engine,damkal
h फ़ायरफ़ाइटर बड़ी लाल गाड़ी में आकर आग बुझाते हैं और लोगों को बचाते हैं! 🚒 वो बहुत बहादुर होते हैं।
e Firefighters come in a big red fire engine to put out fires and help people! 🚒 They're very brave.
g Firefighter badi laal gaadi mein aakar aag bujhaate hain aur logon ko bachaate hain! 🚒 Woh bahut bahadur hote hain.
@job_farmer ? किसान,farmer,farmers,kisan,kisaan
h किसान खेतों में गेहूँ, चावल, सब्ज़ियाँ और फल उगाते हैं — हमारा खाना उन्हीं से आता है! 🌾 किसानों को धन्यवाद!
e Farmers grow wheat, rice, vegetables and fruits in their fields — our food comes from them! 🌾 Thank you, farmers!
g Kisaan kheton mein gehun, chawal, sabziyan aur phal ugaate hain — hamara khaana unhi se aata hai! 🌾 Kisaanon ko dhanyavaad!
@job_chef ? शेफ,रसोइया,बावर्ची,हलवाई,=chef,chefs,=cook,cooks,rasoiya,halwai
h शेफ़ स्वादिष्ट खाना बनाते हैं — रोटी, दाल, सब्ज़ी और मिठाइयाँ! 👩‍🍳 वो साफ़-सफ़ाई का बहुत ध्यान रखते हैं।
e Chefs cook yummy food — roti, dal, vegetables and sweets! 👩‍🍳 They keep everything very clean.
g Chef swaadisht khaana banaate hain — roti, daal, sabzi aur mithaiyan! 👩‍🍳 Woh saaf-safaai ka bahut dhyan rakhte hain.
@job_pilot ? पायलट,pilot,pilots
h पायलट हवाई जहाज़ उड़ाते हैं और लोगों को दूर-दूर के शहरों तक ले जाते हैं! ✈️ वो हमेशा समय के पक्के होते हैं।
e Pilots fly aeroplanes and take people to faraway cities! ✈️ They're always right on time.
g Pilot hawai jahaaz udaate hain aur logon ko door-door ke shehron tak le jaate hain! ✈️ Woh hamesha samay ke pakke hote hain.
@job_driver ? ड्राइवर,चालक,driver,drivers,bus driver
h ड्राइवर बस, कार और ट्रक चलाकर लोगों और सामान को सही जगह पहुँचाते हैं! 🚌 वो सड़क के नियम ध्यान से मानते हैं।
e Drivers drive buses, cars and trucks to take people and things where they need to go! 🚌 They follow the road rules carefully.
g Driver bus, car aur truck chalaakar logon aur saamaan ko sahi jagah pahunchaate hain! 🚌 Woh sadak ke niyam dhyan se maante hain.
@job_postman ? डाकिया,डाकिए,पोस्टमैन,postman,postwoman,mail carrier,dakiya,daakiya
h डाकिया चिट्ठियाँ और पार्सल घर-घर पहुँचाते हैं! 📮 कभी-कभी तोहफ़े भी उन्हीं के साथ आते हैं।
e Postmen and postwomen deliver letters and parcels to every home! 📮 Sometimes presents come with them too.
g Daakiya chitthiyan aur parcel ghar-ghar pahunchaate hain! 📮 Kabhi-kabhi tohfe bhi unhi ke saath aate hain.
@job_carpenter ? बढई,कारपेंटर,carpenter,carpenters,badhai,=badai
h बढ़ई लकड़ी से मेज़, कुर्सी, दरवाज़े और अलमारी बनाते हैं! 🪚 वो नापकर, ध्यान से काम करते हैं।
e Carpenters make tables, chairs, doors and cupboards from wood! 🪚 They measure carefully before they cut.
g Badhai lakdi se mez, kursi, darwaaze aur almaari banaate hain! 🪚 Woh naapkar, dhyan se kaam karte hain.
@job_tailor ? दर्जी,टेलर,tailor,tailors,darzi,darji
h दर्जी कपड़े नापकर काटते हैं और सिलाई करके हमारे कपड़े बनाते हैं! 🧵 सुई-धागा उनका दोस्त है।
e Tailors measure cloth, cut it and stitch it into our clothes! 🧵 Needle and thread are their friends.
g Darzi kapde naapkar kaatte hain aur silaai karke hamare kapde banaate hain! 🧵 Sui-dhaaga unka dost hai.
@job_shopkeeper ? दुकानदार,दुकान वाले,shopkeeper,shopkeepers,dukandar,dukaandaar
h दुकानदार हमें ज़रूरत की चीज़ें बेचते हैं — दाल, चावल, किताबें, खिलौने! 🏪 वो पैसों का हिसाब भी रखते हैं।
e Shopkeepers sell us the things we need — dal, rice, books and toys! 🏪 They keep track of money too.
g Dukaandaar humein zaroorat ki cheezein bechte hain — daal, chawal, kitaabein, khilaune! 🏪 Woh paison ka hisaab bhi rakhte hain.
@job_scientist ? वैज्ञानिक,साइंटिस्ट,scientist,scientists,vaigyanik
h वैज्ञानिक सवाल पूछते हैं, प्रयोग करते हैं और दुनिया के राज़ खोजते हैं! 🔬 तुम भी रोज़ क्यों पूछकर छोटे वैज्ञानिक बन रहे हो।
e Scientists ask questions, do experiments and discover the world's secrets! 🔬 Every time you ask why, you're a little scientist too.
g Scientist sawaal poochte hain, prayog karte hain aur duniya ke raaz khojte hain! 🔬 Tum bhi roz kyun poochhkar chhote scientist ban rahe ho.
@job_engineer ? इंजीनियर,engineer,engineers
h इंजीनियर पुल, सड़कें, मशीनें और कंप्यूटर बनाते हैं! 🛠️ वो सोचते हैं कि चीज़ें बेहतर कैसे काम करें।
e Engineers build bridges, roads, machines and computers! 🛠️ They think about how to make things work better.
g Engineer pul, sadkein, machinein aur computer banaate hain! 🛠️ Woh sochte hain ki cheezein behtar kaise kaam karein.
@job_dentist ? दांतों के डॉक्टर,दांत के डॉक्टर,दंत चिकित्सक,dentist,dentists,teeth doctor,daant ke doctor
h दाँतों के डॉक्टर हमारे दाँत जाँचते हैं और उन्हें मज़बूत और चमकदार रखने में मदद करते हैं! 🦷 रोज़ ब्रश करना उन्हें सबसे अच्छा लगता है।
e Dentists check our teeth and help keep them strong and shiny! 🦷 They love it when you brush every day.
g Daanton ke doctor hamare daant jaanchte hain aur unhe mazboot aur chamakdaar rakhne mein madad karte hain! 🦷 Roz brush karna unhe sabse achha lagta hai.
@job_vet ? जानवरों के डॉक्टर,जानवरों का डॉक्टर,पशु चिकित्सक,=vet,vets,veterinarian,animal doctor,janwaron ke doctor
h जानवरों के डॉक्टर बीमार कुत्ते, बिल्ली, गाय और दूसरे जानवरों का इलाज करते हैं! 🐾 वो जानवरों से बहुत प्यार करते हैं।
e Vets take care of sick dogs, cats, cows and other animals! 🐾 They love animals very much.
g Jaanwaron ke doctor beemaar kutte, billi, gaay aur doosre jaanwaron ka ilaaj karte hain! 🐾 Woh jaanwaron se bahut pyaar karte hain.
@job_barber ? नाई,हेयर कटर,barber,barbers,hairdresser,hair cutter
h नाई हमारे बाल काटकर हमें सुंदर बनाते हैं! 💇 बाल कटवाने में दर्द नहीं होता, बस गुदगुदी होती है।
e Barbers cut our hair and make us look neat! 💇 Haircuts don't hurt — they just tickle.
g Naai hamare baal kaatkar humein sundar banaate hain! 💇 Baal katwaane mein dard nahi hota, bas gudgudi hoti hai.
@job_cleaner ? सफाई कर्मचारी,सफाई वाले,कूड़ा उठाने,cleaner,cleaners,sweeper,safai karmachari,safai wale
h सफ़ाई कर्मचारी हमारी गलियाँ, सड़कें और शहर साफ़ रखते हैं! 🧹 उनका काम बहुत ज़रूरी है — उन्हें धन्यवाद कहना।
e Sanitation workers keep our streets and cities clean! 🧹 Their work is so important — always thank them.
g Safaai karmachari hamari galiyan, sadkein aur shehar saaf rakhte hain! 🧹 Unka kaam bahut zaroori hai — unhe dhanyavaad kehna.
@job_builder ? मिस्त्री,राजमिस्त्री,मजदूर,builder,builders,mason,construction worker,mistri
h मिस्त्री ईंट, सीमेंट और रेत से घर, स्कूल और पुल बनाते हैं! 🧱 हमारा घर भी उन्हीं की मेहनत से बना है।
e Builders use bricks, cement and sand to make homes, schools and bridges! 🧱 Our home was built by their hard work too.
g Mistri eent, cement aur ret se ghar, school aur pul banaate hain! 🧱 Hamara ghar bhi unhi ki mehnat se bana hai.
@job_plumber ? प्लंबर,नल वाले,plumber,plumbers
h प्लंबर पानी के पाइप और नल ठीक करते हैं, ताकि हमारे घर में पानी आता रहे! 🔧 टपकता नल भी वही ठीक करते हैं।
e Plumbers fix water pipes and taps so water keeps flowing into our homes! 🔧 They fix dripping taps too.
g Plumber paani ke pipe aur nal theek karte hain, taaki hamare ghar mein paani aata rahe! 🔧 Tapakta nal bhi wahi theek karte hain.
@job_electrician ? इलेक्ट्रीशियन,बिजली वाले,बिजली मिस्त्री,electrician,electricians
h इलेक्ट्रीशियन बिजली के तार, बल्ब और पंखे ठीक करते हैं! 💡 बिजली का काम सिर्फ़ वही करते हैं, बच्चे नहीं।
e Electricians fix wires, bulbs and fans! 💡 Only trained grown-ups do electrical work — never children.
g Electrician bijli ke taar, bulb aur pankhe theek karte hain! 💡 Bijli ka kaam sirf wahi karte hain, bachche nahi.
@job_soldier ? सैनिक,फौजी,सेना,सिपाही,soldier,soldiers,army,fauji,sainik,=sena
h सैनिक हमारे देश की सीमाओं की रखवाली करते हैं, और बाढ़ या भूकंप में लोगों की मदद भी करते हैं! 🎖️ वो रोज़ कसरत करते हैं और समय के पक्के होते हैं।
e Soldiers guard our country's borders, and help people during floods and earthquakes too! 🎖️ They exercise every day and are always on time.
g Sainik hamare desh ki seemaaon ki rakhwaali karte hain, aur baadh ya bhookamp mein logon ki madad bhi karte hain! 🎖️ Woh roz kasrat karte hain aur samay ke pakke hote hain.
@job_artist ? चित्रकार,कलाकार,artist,artists,painter,painters,chitrakar,kalakar
h चित्रकार रंगों और ब्रश से सुंदर तस्वीरें बनाते हैं! 🎨 तुम भी आज एक चित्र बनाकर कलाकार बन सकते हो।
e Artists make beautiful pictures with colours and brushes! 🎨 You can be an artist today by drawing a picture.
g Chitrakaar rangon aur brush se sundar tasveerein banaate hain! 🎨 Tum bhi aaj ek chitra banaakar kalaakaar ban sakte ho.
@jobs_why लोग,बडे,people,grown ups,grownups,=log + काम,नौकरी,=work,=job,jobs,=kaam,naukri + $WHY,$WHAT
h हर काम दूसरों की मदद करता है — किसान खाना उगाते हैं, डॉक्टर इलाज करते हैं, टीचर पढ़ाते हैं! 🛠️ सब मिलकर काम करते हैं, तभी दुनिया चलती है।
e Every job helps others — farmers grow food, doctors heal, teachers teach! 🛠️ Everyone works together, and that keeps the world going.
g Har kaam doosron ki madad karta hai — kisaan khaana ugaate hain, doctor ilaaj karte hain, teacher padhaate hain! 🛠️ Sab milkar kaam karte hain, tabhi duniya chalti hai.
`);

  def("fun", `
@jokes * चुटकुला,चुटकुले,जोक,जोक्स,हंसाओ,joke,jokes,chutkula,chutkule,hasao,hansao,make me laugh,something funny,कुछ मजेदार
h हाथी फ़्रिज में कैसे जाएगा? दरवाज़ा खोलो, हाथी अंदर, दरवाज़ा बंद! 🐘😄
e How do you put an elephant in a fridge? Open the door, elephant in, close the door! 🐘😄
g Haathi fridge mein kaise jaayega? Darwaaza kholo, haathi andar, darwaaza band! 🐘😄
h टमाटर लाल क्यों हो गया? क्योंकि उसने सलाद को कपड़े बदलते देख लिया! 🍅😄
e Why did the tomato turn red? Because it saw the salad dressing! 🍅😄
g Tamatar laal kyun ho gaya? Kyunki usne salad ko kapde badalte dekh liya! 🍅😄
h सोते हुए डायनासोर को क्या कहते हैं? डायना-सो-रहा! 🦖😴
e What do you call a sleeping dinosaur? A dino-snore! 🦖😴
g Sote hue dinosaur ko kya kehte hain? Dina-so-raha! 🦖😴
h कौन सी चीज़ ऊपर जाती है पर कभी नीचे नहीं आती? तुम्हारी उम्र! 🎂😄
e What goes up but never comes down? Your age! 🎂😄
g Kaun si cheez upar jaati hai par kabhi neeche nahi aati? Tumhari umar! 🎂😄
h आलू ने प्याज़ से पूछा — तुम सबको रुलाते क्यों हो? प्याज़ बोला — मैं तो बस हैलो कहता हूँ! 🧅😄
e The potato asked the onion, why do you make everyone cry? The onion said, I'm only saying hello! 🧅😄
g Aalu ne pyaaz se poocha — tum sabko rulaate kyun ho? Pyaaz bola — main toh bas hello kehta hoon! 🧅😄
h बंदर ने शीशे में देखकर कहा — अरे, ये इतना सुंदर बंदर कौन है! 🐒😄
e The monkey looked in the mirror and said, who is this handsome monkey! 🐒😄
g Bandar ne sheeshe mein dekhkar kaha — arre, yeh itna sundar bandar kaun hai! 🐒😄
h बादल ने सूरज से कहा — छुपन-छुपाई खेलें? सूरज बोला — ठीक है, पर मैं तो चमककर पकड़ा जाऊँगा! ☁️☀️😄
e The cloud asked the sun, shall we play hide and seek? The sun said, okay, but my shine will give me away! ☁️☀️😄
g Baadal ne suraj se kaha — chhupan-chhupaai khelein? Suraj bola — theek hai, par main toh chamakkar pakda jaunga! ☁️☀️😄
h पेंसिल ने रबड़ से कहा — तुम मेरी गलतियाँ मिटाती हो, तुम मेरी सबसे अच्छी दोस्त हो! ✏️😄
e The pencil said to the eraser, you fix my mistakes — you're my best friend! ✏️😄
g Pencil ne rubber se kaha — tum meri galtiyan mitaati ho, tum meri sabse achhi dost ho! ✏️😄
@riddles * पहेली,पहेलियां,बूझो,riddle,riddles,paheli,pahelian,puzzle
h पहेली: हरा हूँ पर पत्ता नहीं, बोलता हूँ पर इंसान नहीं — बताओ कौन? 🤔 तोता — यानी मैं! 🦜
e Riddle: I'm green but not a leaf, I talk but I'm not a person — who am I? 🤔 A parrot — that's me! 🦜
g Paheli: Hara hoon par patta nahi, bolta hoon par insaan nahi — batao kaun? 🤔 Tota — yaani main! 🦜
h पहेली: लाल-लाल, गोल-मटोल, अंदर दाने अनमोल — बताओ क्या? 🤔 अनार! ❤️
e Riddle: Red and round, with jewel-like seeds inside — what is it? 🤔 A pomegranate! ❤️
g Paheli: Laal-laal, gol-matol, andar daane anmol — batao kya? 🤔 Anaar! ❤️
h पहेली: दिन में सोता, रात को जागता, हू-हू करता — बताओ कौन? 🤔 उल्लू! 🦉
e Riddle: I sleep in the day, wake up at night and say hoo hoo — who am I? 🤔 An owl! 🦉
g Paheli: Din mein sota, raat ko jaagta, hoo-hoo karta — batao kaun? 🤔 Ullu! 🦉
h पहेली: चार पैर हैं पर चलती नहीं, उस पर हम बैठते हैं — बताओ क्या? 🤔 कुर्सी! 🪑
e Riddle: I have four legs but I can't walk, and you sit on me — what am I? 🤔 A chair! 🪑
g Paheli: Chaar pair hain par chalti nahi, us par hum baithte hain — batao kya? 🤔 Kursi! 🪑
h पहेली: बिना पंख के उड़ती हूँ, धागे से बँधी रहती हूँ — बताओ कौन? 🤔 पतंग! 🪁
e Riddle: I fly without wings and I'm tied to a string — what am I? 🤔 A kite! 🪁
g Paheli: Bina pankh ke udti hoon, dhaage se bandhi rehti hoon — batao kaun? 🤔 Patang! 🪁
h पहेली: बाहर से पीला, अंदर से मीठा, बंदर का प्यारा — बताओ क्या? 🤔 केला! 🍌
e Riddle: Yellow outside, sweet inside, a monkey's favourite — what is it? 🤔 A banana! 🍌
g Paheli: Bahar se peela, andar se meetha, bandar ka pyaara — batao kya? 🤔 Kela! 🍌
@tongue_twister * टंग ट्विस्टर,जीभ घुमाओ,जल्दी जल्दी बोलो,tongue twister,tongue twisters,jeebh ghumao,jaldi jaldi bolo
h जल्दी-जल्दी बोलो: कच्चा पापड़, पक्का पापड़! 😄
e Say it fast: red lorry, yellow lorry! 😄
g Jaldi-jaldi bolo: kachcha papad, pakka papad! 😄
h जल्दी बोलो: चंदू के चाचा ने, चंदू की चाची को, चाँदनी चौक में, चाँदी के चम्मच से चटनी चटाई! 😄
e Say it fast: she sells seashells by the seashore! 😄
g Jaldi bolo: Chandu ke chacha ne, Chandu ki chachi ko, Chandni Chowk mein, chaandi ke chammach se chatni chataai! 😄
h जल्दी बोलो: पीतल के पतीले में पपीता पीला-पीला! 😄
e Say it fast: Peter Piper picked a peck of pickled peppers! 😄
g Jaldi bolo: peetal ke pateele mein papita peela-peela! 😄
h जल्दी बोलो: खड़क सिंह के खड़कने से खड़कती हैं खिड़कियाँ! 😄
e Say it fast: toy boat, toy boat, toy boat! 😄
g Jaldi bolo: Khadak Singh ke khadakne se khadakti hain khidkiyaan! 😄
@would_you_rather * ये या वो,क्या चुनोगे,would you rather,this or that,kya chunoge,ye ya wo
f -
h बताओ, तुम क्या बनना चाहोगे — उड़ने वाली तितली या तैरने वाली मछली? 🦋🐟
e Would you rather be a butterfly that flies or a fish that swims? 🦋🐟
g Batao, tum kya banna chahoge — udne wali titli ya tairne wali machhli? 🦋🐟
h तुम क्या खाना चाहोगे — मीठा आम या रसीला तरबूज़? 🥭🍉
e Would you rather eat a sweet mango or a juicy watermelon? 🥭🍉
g Tum kya khaana chahoge — meetha aam ya raseela tarbooz? 🥭🍉
h तुम कहाँ जाना चाहोगे — चाँद पर या समुद्र के अंदर? 🌙🌊
e Would you rather visit the moon or the bottom of the sea? 🌙🌊
g Tum kahan jaana chahoge — chaand par ya samudra ke andar? 🌙🌊
h तुम कौन सी आवाज़ निकालोगे — शेर की दहाड़ या मुर्गे की कुकड़ूँ-कूँ? 🦁🐓
e Would you rather roar like a lion or crow like a rooster? 🦁🐓
g Tum kaun si awaaz nikaaloge — sher ki dahaad ya murge ki kukdoo-koo? 🦁🐓
h तुम्हें क्या ज़्यादा पसंद है — बारिश में छप-छप या धूप में दौड़ना? 🌧️☀️
e Would you rather splash in the rain or run in the sunshine? 🌧️☀️
g Tumhe kya zyada pasand hai — baarish mein chhap-chhap ya dhoop mein daudna? 🌧️☀️
h तुम किसके साथ खेलोगे — हाथी के साथ पानी उछालना या बंदर के साथ झूला झूलना? 🐘🐒
e Would you rather splash water with an elephant or swing with a monkey? 🐘🐒
g Tum kiske saath kheloge — haathi ke saath paani uchhaalna ya bandar ke saath jhoola jhoolna? 🐘🐒
@pretend_play * कल्पना,नाटक वाला खेल,चलो नाटक,सोचो कि,pretend,let's pretend,lets pretend,imagine,make believe,socho ki,kalpana
h चलो सोचो कि तुम एक छोटी चिड़िया हो — हाथ फैलाओ और कमरे में धीरे-धीरे उड़ो! 🐦 अब किसी पेड़ पर बैठकर चीं-चीं करो।
e Let's pretend you're a little bird — spread your arms and fly slowly around the room! 🐦 Now land on a tree and go cheep cheep.
g Chalo socho ki tum ek chhoti chidiya ho — haath phailao aur kamre mein dheere-dheere udo! 🐦 Ab kisi ped par baithkar cheen-cheen karo.
h चलो सोचो कि फ़र्श एक नदी है और तकिये पत्थर — एक तकिये से दूसरे पर कदम रखो! 🪨 धीरे-धीरे, बड़ों के साथ।
e Let's pretend the floor is a river and cushions are stepping stones — step from one to the next! 🪨 Slowly, with a grown-up nearby.
g Chalo socho ki farsh ek nadi hai aur takiye patthar — ek takiye se doosre par kadam rakho! 🪨 Dheere-dheere, badon ke saath.
h चलो सोचो कि हम रॉकेट में चाँद पर जा रहे हैं — दस से उल्टी गिनती करो! 🚀 दस, नौ, आठ — अब उड़ो!
e Let's pretend we're flying a rocket to the moon — count down from ten! 🚀 Ten, nine, eight — blast off!
g Chalo socho ki hum rocket mein chaand par ja rahe hain — das se ulti ginti karo! 🚀 Das, nau, aath — ab udo!
h चलो सोचो कि तुम एक बड़े शेफ़ हो — खिलौनों से एक मज़ेदार खाना बनाओ! 🍲 मुझे बताना उसमें क्या-क्या डाला।
e Let's pretend you're a big chef — cook a yummy meal with your toys! 🍲 Tell me what you put in it.
g Chalo socho ki tum ek bade chef ho — khilaunon se ek mazedaar khaana banao! 🍲 Mujhe batana usmein kya-kya daala.
h चलो सोचो कि तुम सर्दियों में सोने वाले भालू हो — आँखें बंद करो और धीरे-धीरे साँस लो! 🐻 अब जागो और ज़ोर से अंगड़ाई लो।
e Let's pretend you're a bear sleeping through winter — close your eyes and breathe slowly! 🐻 Now wake up and give a big stretch.
g Chalo socho ki tum sardiyon mein sone wale bhaalu ho — aankhein band karo aur dheere-dheere saans lo! 🐻 Ab jaago aur zor se angdaai lo.
h चलो सोचो कि तुम डॉक्टर हो — अपने टेडी का दिल धक-धक सुनो! 🧸 उसे बताओ कि वो बिल्कुल ठीक है।
e Let's pretend you're a doctor — listen to your teddy's heart go thump-thump! 🧸 Tell teddy everything is okay.
g Chalo socho ki tum doctor ho — apne teddy ka dil dhak-dhak suno! 🧸 Use batao ki woh bilkul theek hai.
@fun_fact रोचक बात,मजेदार बात,कुछ नया बताओ,क्या तुम जानते,fun fact,fun facts,did you know,something new,interesting fact,kuch naya batao,mazedaar baat
h क्या तुम जानते हो? घोंघा लगातार कई महीनों तक सो सकता है! 🐌
e Did you know? A snail can sleep for months at a time! 🐌
g Kya tum jaante ho? Ghongha lagaataar kai mahinon tak so sakta hai! 🐌
h क्या तुम जानते हो? शहद बरसों तक खराब नहीं होता! 🍯
e Did you know? Honey can stay good for years and years! 🍯
g Kya tum jaante ho? Shahad barson tak kharaab nahi hota! 🍯
h क्या तुम जानते हो? समुद्री ऊदबिलाव सोते समय एक-दूसरे का हाथ पकड़ते हैं, ताकि बह न जाएँ! 🦦
e Did you know? Sea otters hold hands while they sleep so they don't drift apart! 🦦
g Kya tum jaante ho? Samudri oodbilaav sote samay ek-doosre ka haath pakadte hain, taaki beh na jaayein! 🦦
h क्या तुम जानते हो? केला असल में एक बेरी है, पर स्ट्रॉबेरी नहीं! 🍌
e Did you know? A banana is really a berry, but a strawberry isn't! 🍌
g Kya tum jaante ho? Kela asal mein ek berry hai, par strawberry nahi! 🍌
h क्या तुम जानते हो? एक बादल कई हाथियों जितना भारी हो सकता है! ☁️
e Did you know? A single cloud can weigh as much as lots of elephants! ☁️
g Kya tum jaante ho? Ek baadal kai haathiyon jitna bhaari ho sakta hai! ☁️
h क्या तुम जानते हो? हमारे शरीर की सबसे छोटी हड्डी कान के अंदर होती है! 👂
e Did you know? The smallest bone in your body is inside your ear! 👂
g Kya tum jaante ho? Hamare shareer ki sabse chhoti haddi kaan ke andar hoti hai! 👂
h क्या तुम जानते हो? ऑक्टोपस के तीन दिल होते हैं! 🐙
e Did you know? An octopus has three hearts! 🐙
g Kya tum jaante ho? Octopus ke teen dil hote hain! 🐙
h क्या तुम जानते हो? हाथी अपनी सूँड से एक बार में ढेर सारा पानी उठा लेता है! 🐘
e Did you know? An elephant can hold lots of water in its trunk at once! 🐘
g Kya tum jaante ho? Haathi apni soond se ek baar mein dher saara paani utha leta hai! 🐘
@cow_fly * गाय,cow,gaay + उड,उडती,उड सकती,=fly,flies,udti,ud sakti
h नहीं, गाय उड़ नहीं सकती — उसके पंख नहीं हैं! 🐄 पर सोचो, उड़ती गाय कितनी मज़ेदार लगती!
e No, cows can't fly — they have no wings! 🐄 But imagine a flying cow — how funny would that be!
g Nahi, gaay ud nahi sakti — uske pankh nahi hain! 🐄 Par socho, udti gaay kitni mazedaar lagti!
@mitthu_says * मिट्ठू कहता,simon says,mitthu says,mitthu kehta
h मिट्ठू कहता है — अपनी नाक छुओ! 👃 मिट्ठू कहता है — एक पैर पर खड़े हो जाओ!
e Mitthu says — touch your nose! 👃 Mitthu says — stand on one leg!
g Mitthu kehta hai — apni naak chhuo! 👃 Mitthu kehta hai — ek pair par khade ho jao!
h मिट्ठू कहता है — ताली बजाओ! 👏 मिट्ठू कहता है — मेंढक की तरह कूदो!
e Mitthu says — clap your hands! 👏 Mitthu says — hop like a frog!
g Mitthu kehta hai — taali bajao! 👏 Mitthu kehta hai — mendhak ki tarah koodo!
h मिट्ठू कहता है — हाथ ऊपर करो! 🙌 मिट्ठू कहता है — धीरे से घूमो!
e Mitthu says — hands up high! 🙌 Mitthu says — turn around slowly!
g Mitthu kehta hai — haath upar karo! 🙌 Mitthu kehta hai — dheere se ghoomo!
@animal_walks * जानवर की तरह चलो,जानवरों की चाल,animal walk,walk like,janwar ki tarah chalo
h चलो जानवरों वाली चाल: हाथी की तरह धम-धम चलो! 🐘 अब खरगोश की तरह फुदको!
e Animal walks: stomp like an elephant! 🐘 Now hop like a bunny!
g Chalo jaanwaron wali chaal: haathi ki tarah dham-dham chalo! 🐘 Ab khargosh ki tarah phudko!
h चलो जानवरों वाली चाल: केकड़े की तरह साइड में चलो! 🦀 अब पेंगुइन की तरह डगमग!
e Animal walks: walk sideways like a crab! 🦀 Now waddle like a penguin!
g Chalo jaanwaron wali chaal: kekde ki tarah side mein chalo! 🦀 Ab penguin ki tarah dagmag!
`);

  def("nature", `
@moon_far $MOON + दूर,कितना दूर,=far,how far,distance,=dur,kitna dur
h चाँद बहुत दूर है — अगर कार से जा पाते, तो कई महीने लग जाते! 🌙 रॉकेट से अंतरिक्ष यात्री कुछ ही दिनों में पहुँचे थे।
e The moon is very far away — driving there in a car would take months! 🌙 Astronauts got there in a rocket in just a few days.
g Chaand bahut door hai — agar car se ja paate, toh kai mahine lag jaate! 🌙 Rocket se astronaut kuch hi dinon mein pahunche the.
@sun_size $SUN + कितना बडा,कितना बड़ा,how big,=big,bigger,size,=bada,kitna bada,साइज
h सूरज इतना बड़ा है कि उसमें लाखों धरतियाँ समा जाएँ! ☀️ बस बहुत दूर होने से वो छोटा दिखता है।
e The sun is so big that over a million Earths could fit inside it! ☀️ It only looks small because it's so far away.
g Suraj itna bada hai ki usmein laakhon dhartiyan sama jaayein! ☀️ Bas bahut door hone se woh chhota dikhta hai.
@sea_blue $SEA,समुद्री + नील,=blue,neela,nila
h समुद्र का पानी लाल रोशनी सोख लेता है और नीली रोशनी लौटा देता है, इसलिए गहरा समुद्र नीला दिखता है! 🌊 ऊपर से वो आसमान का रंग भी चमकाता है।
e Sea water soaks up red light and sends back blue light, so the deep sea looks blue! 🌊 It also reflects the colour of the sky.
g Samudra ka paani laal roshni sokh leta hai aur neeli roshni lauta deta hai, isliye gehra samudra neela dikhta hai! 🌊 Upar se woh aasmaan ka rang bhi chamkaata hai.
@sea_deep $SEA + गहरा,गहराई,=deep,depth,gehra,gahra
h समुद्र कुछ जगहों पर इतना गहरा है कि सबसे ऊँचा पहाड़ भी उसमें पूरा डूब जाए! 🌊 वहाँ बहुत अँधेरा होता है, और अनोखी चमकने वाली मछलियाँ रहती हैं।
e In some places the sea is so deep that even the tallest mountain would fit under the water! 🌊 It's very dark down there, and strange glowing fish live there.
g Samudra kuch jagahon par itna gehra hai ki sabse ooncha pahaad bhi usmein poora doob jaaye! 🌊 Wahan bahut andhera hota hai, aur anokhi chamakne wali machhliyan rehti hain.
`);

  def("animals", `
@cat_milk बिल्ल,cat,cats,billi + दूध,milk,doodh,=dudh
h बिल्लियों को दूध अच्छा लगता है, पर ज़्यादा दूध उनका पेट खराब कर सकता है! 🐱 उनके लिए पानी और बिल्लियों वाला खाना सबसे अच्छा है।
e Cats like milk, but too much can upset their tummies! 🐱 Water and cat food are best for them.
g Billiyon ko doodh achha lagta hai, par zyada doodh unka pet kharaab kar sakta hai! 🐱 Unke liye paani aur billiyon wala khaana sabse achha hai.
`);

  def("plants", `
@plant_breathe $PLANT,पत्ते,leaves + सांस,breathe,breathing,saans,=sans
h पेड़-पौधे पत्तियों के नन्हे-नन्हे छेदों से साँस लेते हैं! 🌿 वो वही हवा लेते हैं जो हम छोड़ते हैं, और हमें ताज़ी हवा लौटाते हैं।
e Plants breathe through teeny tiny holes in their leaves! 🌿 They take in the air we breathe out and give us fresh air back.
g Ped-paudhe pattiyon ke nanhe-nanhe chhedon se saans lete hain! 🌿 Woh wahi hawa lete hain jo hum chhodte hain, aur humein taazi hawa lautaate hain.
`);

  def("body", `
@vaccine टीका,टीके,इंजेक्शन,सुई,vaccine,vaccines,injection,injections,=tika,=teeka + $WHY,$WHAT,$HOW,लगाते,लगवाना,=lagate
h टीका हमारे शरीर को बीमारियों से लड़ने की ताक़त सिखाता है! 💉 बस एक छोटी-सी चुभन होती है, फिर तुम और मज़बूत — किसी बड़े का हाथ पकड़ लेना।
e A vaccine teaches your body how to fight off illnesses! 💉 It's just a tiny pinch, and then you're even stronger — hold a grown-up's hand.
g Teeka hamare shareer ko beemaariyon se ladne ki taakat sikhaata hai! 💉 Bas ek chhoti si chubhan hoti hai, phir tum aur mazboot — kisi bade ka haath pakad lena.
`);

  def("family", `
@babies_eat बेबी,छोटे बच्चे,नन्हे बच्चे,=baby,babies,chhote bachche + $EAT,दूध,=milk,doodh - $ANIMALNAMES
h छोटे बेबी पहले बस दूध पीते हैं, क्योंकि उनके दाँत नहीं होते! 🍼 फिर धीरे-धीरे दलिया और मसला हुआ नरम खाना खाते हैं।
e Little babies drink only milk at first, because they have no teeth! 🍼 Then slowly they start eating soft, mashed food.
g Chhote baby pehle bas doodh peete hain, kyunki unke daant nahi hote! 🍼 Phir dheere-dheere daliya aur masla hua naram khaana khaate hain.
@babies_cry बेबी,छोटे बच्चे,नन्हे बच्चे,=baby,babies,chhote bachche + रोते,रोता,रोती,=cry,cries,crying,=rote,=rota - $ANIMALNAMES
h बेबी बोल नहीं सकते, इसलिए रोकर बताते हैं — भूख लगी है, नींद आई है या गोद चाहिए! 👶 तुम भी छोटे थे तब ऐसे ही बताते थे।
e Babies can't talk yet, so they cry to say I'm hungry, I'm sleepy or please hold me! 👶 You did the same when you were tiny.
g Baby bol nahi sakte, isliye rokar bataate hain — bhookh lagi hai, neend aayi hai ya god chahiye! 👶 Tum bhi chhote the tab aise hi bataate the.
@grownup_angry ! $FAMILY,बडे,टीचर,teacher,grown up,grownup + गुस्सा,गुस्से,नाराज,डांट,डांटा,डांटती,डांटते,angry,=mad,upset,scold,scolded,shouted,gussa,naraz,daant,danta,daanti
h जब बड़े डाँटते या गुस्सा होते हैं, तो मन दुखता है, ये ठीक है। 💛 थोड़ी देर बाद उनसे प्यार से बात करो और बताओ कि तुम्हें कैसा लगा।
e When grown-ups are cross or tell you off, it can feel sad — that's okay. 💛 After a little while, talk to them gently and tell them how you felt.
g Jab bade daant-te ya gussa hote hain, toh mann dukhta hai, yeh theek hai. 💛 Thodi der baad unse pyaar se baat karo aur batao ki tumhe kaisa laga.
@money पैसा,पैसे,रुपया,रुपये,money,=paisa,paise,rupee,rupees,rupaya + $Q,आते,कमाते,=earn,aate,kamate
h पैसों से हम दुकान से चीज़ें खरीदते हैं, और बड़े काम करके पैसे कमाते हैं! 💰 पैसे संभालकर रखना और ज़रूरत पर ही खर्च करना अच्छी आदत है।
e We use money to buy things from shops, and grown-ups earn money by working! 💰 Saving money and spending it carefully is a good habit.
g Paison se hum dukaan se cheezein khareedte hain, aur bade kaam karke paise kamaate hain! 💰 Paise sambhaalkar rakhna aur zaroorat par hi kharch karna achhi aadat hai.
`);

  /*@@DATA@@*/

  /* ================= Computed answers: what comes after/before a day, month or number ================= */

  var DAYS = [L("सोमवार", "Monday", "Somvaar"), L("मंगलवार", "Tuesday", "Mangalvaar"), L("बुधवार", "Wednesday", "Budhvaar"),
    L("गुरुवार", "Thursday", "Guruvaar"), L("शुक्रवार", "Friday", "Shukravaar"), L("शनिवार", "Saturday", "Shanivaar"), L("रविवार", "Sunday", "Ravivaar")];
  var DAY_KEYS = [["सोमवार", "monday", "somvar", "somvaar"], ["मंगलवार", "tuesday", "mangalvar", "mangalvaar"],
    ["बुधवार", "wednesday", "budhvar", "budhvaar"], ["गुरुवार", "बृहस्पतिवार", "thursday", "guruvar", "guruvaar", "brihaspativar"],
    ["शुक्रवार", "friday", "shukravar", "shukravaar"], ["शनिवार", "saturday", "shanivar", "shanivaar"],
    ["रविवार", "इतवार", "sunday", "ravivar", "ravivaar", "itvar", "itvaar"]];
  var MONTHS = [L("जनवरी", "January", "January"), L("फ़रवरी", "February", "February"), L("मार्च", "March", "March"), L("अप्रैल", "April", "April"),
    L("मई", "May", "May"), L("जून", "June", "June"), L("जुलाई", "July", "July"), L("अगस्त", "August", "August"),
    L("सितंबर", "September", "September"), L("अक्टूबर", "October", "October"), L("नवंबर", "November", "November"), L("दिसंबर", "December", "December")];
  var MONTH_KEYS = [["जनवरी", "january"], ["फरवरी", "february", "farvari"], ["=मार्च", "march"], ["अप्रैल", "april", "aprail"], ["=मई", "=may"],
    ["=जून", "=june", "=jun"], ["जुलाई", "july", "julai"], ["अगस्त", "august", "agast"], ["सितंबर", "september", "sitambar"],
    ["अक्टूबर", "अक्तूबर", "october", "aktubar"], ["नवंबर", "november", "navambar"], ["दिसंबर", "december", "disambar"]];
  var NUMW = { "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "छह": 6, "छः": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
    "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14, "पंद्रह": 15, "सोलह": 16, "सत्रह": 17, "अठारह": 18, "उन्नीस": 19, "बीस": 20,
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
    ek: 1, teen: 3, chaar: 4, char: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10, bees: 20 };
  var NUMW_N = {};
  Object.keys(NUMW).forEach(function (k) { NUMW_N[norm(k)] = NUMW[k]; });
  macro("AFTER", "के बाद,बाद कौन,बाद क्या,after,next,=baad,ke bad,ke baad,अगला,अगली,agla,agli");
  macro("BEFORE", "से पहले,पहले कौन,पहले क्या,before,se pehle,se pahle,pehle,pahle,पिछला,पिछली");
  function findIn(t, keys) {
    for (var i = 0; i < keys.length; i++) for (var j = 0; j < keys[i].length; j++) { var c = kw(keys[i][j]); if (c && kwTest(c, t)) return i; }
    return -1;
  }
  function findNum(t) {
    var m = t.match(/(?<![\p{L}\p{N}])(\d{1,3})(?![\p{L}\p{N}])/u);
    if (m) return parseInt(m[1], 10);
    var w = t.split(" ");
    for (var i = 0; i < w.length; i++) if (Object.prototype.hasOwnProperty.call(NUMW_N, w[i])) return NUMW_N[w[i]];
    return -1;
  }
  var NEED = {
    day: function (t) { return findIn(t, DAY_KEYS) >= 0; },
    month: function (t) { return findIn(t, MONTH_KEYS) >= 0; },
    num: function (t) { return findNum(t) >= 0; },
  };
  var SEQ = {
    day: L("{a} के {w} {b} आता है! 📅", "{b} comes {w} {a}! 📅", "{a} ke {w} {b} aata hai! 📅"),
    month: L("{a} के {w} {b} का महीना आता है! 🗓️", "{b} comes {w} {a}! 🗓️", "{a} ke {w} {b} ka mahina aata hai! 🗓️"),
    num: L("{a} के {w} {b} आता है! 🔢", "{b} comes {w} {a}! 🔢", "{a} ke {w} {b} aata hai! 🔢"),
    after: L("बाद", "after", "baad"), before: L("पहले", "before", "pehle"),
  };
  function seqAnswer(kind, dir) {
    return function (t, lang) {
      var a, b, i;
      if (kind === "day") { i = findIn(t, DAY_KEYS); if (i < 0) return null; a = DAYS[i][lang]; b = DAYS[(i + (dir === "after" ? 1 : 6)) % 7][lang]; }
      else if (kind === "month") { i = findIn(t, MONTH_KEYS); if (i < 0) return null; a = MONTHS[i][lang]; b = MONTHS[(i + (dir === "after" ? 1 : 11)) % 12][lang]; }
      else {
        i = findNum(t); if (i < 0 || i > 999 || (dir === "before" && i === 0)) return null;
        a = String(i); b = String(dir === "after" ? i + 1 : i - 1);
      }
      return SEQ[kind][lang].split("{a}").join(a).split("{b}").join(b).split("{w}").join(SEQ[dir][lang]);
    };
  }
  ["day", "month", "num"].forEach(function (k) {
    ["after", "before"].forEach(function (dir) {
      addIntent({ id: k + "_" + dir, cat: k === "num" ? "numbers" : "time", groups: [MACRO[dir.toUpperCase()]], neg: null,
        cue: true, sens: false, a: { hi: [], en: [], hinglish: [] }, f: null, fn: seqAnswer(k, dir), need: NEED[k], bonus: 12 });
    });
  });

  /* "नीला और पीला मिलाकर क्या बनता है?" → the colour those two make. */
  var COLS = [
    [L("लाल", "red", "laal"), ["=लाल", "=red", "=laal", "=lal"]],
    [L("नीला", "blue", "neela"), ["नीला", "नीले", "नीली", "=blue", "=neela", "=nila", "=neele"]],
    [L("पीला", "yellow", "peela"), ["पीला", "पीले", "पीली", "yellow", "=peela", "=pila", "=peele"]],
    [L("सफ़ेद", "white", "safed"), ["सफेद", "white", "=safed"]],
    [L("काला", "black", "kaala"), ["=काला", "=काले", "black", "=kala", "=kaala"]],
  ];
  var COL_MIX = { "1,2": L("हरा", "green", "hara"), "0,2": L("नारंगी", "orange", "narangi"), "0,1": L("बैंगनी", "purple", "baingani"),
    "0,3": L("गुलाबी", "pink", "gulaabi"), "3,4": L("सलेटी", "grey", "saleti"), "1,3": L("आसमानी", "light blue", "aasmaani"),
    "2,3": L("हल्का पीला", "light yellow", "halka peela") };
  function colsIn(t) {
    var out = [];
    for (var i = 0; i < COLS.length; i++) for (var j = 0; j < COLS[i][1].length; j++) {
      var c = kw(COLS[i][1][j]);
      if (c && kwTest(c, t)) { out.push(i); break; }
    }
    return out;
  }
  var MIX_LINE = L("{a} और {b} मिलाओ, तो {c} रंग बनता है! 🎨 आज रंगों से ये जादू करके देखो।",
    "Mix {a} and {b} and you get {c}! 🎨 Try this colour magic today.",
    "{a} aur {b} milao, toh {c} rang banta hai! 🎨 Aaj rangon se yeh jaadu karke dekho.");
  addIntent({ id: "mix_colours", cat: "numbers", groups: [MACRO.MIX], neg: null, cue: false, sens: false, a: { hi: [], en: [], hinglish: [] }, f: null,
    bonus: 14,
    need: function (t) { var c = colsIn(t); return c.length === 2 && !!COL_MIX[c.join(",")]; },
    fn: function (t, lang) {
      var c = colsIn(t), res = COL_MIX[c.join(",")];
      if (c.length !== 2 || !res) return null;
      var s = MIX_LINE[lang].split("{a}").join(COLS[c[0]][0][lang]).split("{b}").join(COLS[c[1]][0][lang]).split("{c}").join(res[lang]);
      return lang === "hi" ? s : s.charAt(0).toUpperCase() + s.slice(1);
    } });

  /* ================= Lead-ins & follow-ups ================= */

  var LEAD_Q = [L("अच्छा सवाल!", "Good question!", "Achha sawaal!"), L("वाह, क्या सवाल है!", "Ooh, what a question!", "Wah, kya sawaal hai!"),
    L("सुनो!", "Listen!", "Suno!"), L("हम्म, बताता हूँ!", "Hmm, let me tell you!", "Hmm, batata hoon!")];
  var LEAD_S = [L("वाह!", "Wow!", "Wah!"), L("अरे वाह!", "Oh, lovely!", "Arre wah!"), L("अच्छा!", "Oh!", "Achha!")];
  var LEAD_CATS = { nature: 1, animals: 1, plants: 1, body: 1, time: 1, numbers: 1, india: 1, science: 1, jobs: 1 };
  var FOLLOW = {};
  function follow(cat, lines) { FOLLOW[cat] = lines.map(fu); }

  follow("nature", ["तुम्हें बारिश ज़्यादा अच्छी लगती है या धूप? / Do you like rain or sunshine more? / Tumhe baarish zyada achhi lagti hai ya dhoop?",
    "खिड़की से देखकर बताओ, आज आसमान कैसा है? / Look out of the window — what does the sky look like today? / Khidki se dekhkar batao, aaj aasmaan kaisa hai?",
    "तुमने कभी इंद्रधनुष देखा है? / Have you ever seen a rainbow? / Tumne kabhi indradhanush dekha hai?",
    "आज रात चाँद देखोगे? / Will you look at the moon tonight? / Aaj raat chaand dekhoge?"]);
  follow("animals", ["तुम्हें कौन सा जानवर सबसे अच्छा लगता है? / Which animal do you like the most? / Tumhe kaun sa jaanwar sabse achha lagta hai?",
    "तुम किस जानवर की आवाज़ निकाल सकते हो? / Which animal sound can you make? / Tum kis jaanwar ki awaaz nikaal sakte ho?",
    "अगर तुम एक दिन जानवर बनो, तो कौन सा बनोगे? / If you were an animal for a day, which one would you be? / Agar tum ek din jaanwar bano, toh kaun sa banoge?",
    "चलो, उस जानवर की तरह चलकर दिखाओगे? / Can you walk like that animal? / Chalo, us jaanwar ki tarah chalkar dikhaoge?"]);
  follow("plants", ["तुम्हारा पसंदीदा फल कौन सा है? / What is your favourite fruit? / Tumhara favourite phal kaun sa hai?",
    "आज तुमने कौन सी हरी चीज़ खाई? / What green thing did you eat today? / Aaj tumne kaun si hari cheez khaayi?",
    "क्या तुम एक बीज बोकर पौधा उगाना चाहोगे? / Would you like to plant a seed and grow a plant? / Kya tum ek beej bokar paudha ugaana chahoge?",
    "तुम्हें आम ज़्यादा पसंद है या केला? / Do you like mangoes or bananas more? / Tumhe aam zyada pasand hai ya kela?"]);
  follow("body", ["चलो, अपनी नाक छूकर दिखाओगे? / Can you touch your nose? / Chalo, apni naak chhookar dikhaoge?",
    "तुम कितनी ऊँची छलाँग लगा सकते हो? / How high can you jump? / Tum kitni oonchi chhalaang laga sakte ho?",
    "आज तुमने पानी पिया? / Have you had some water today? / Aaj tumne paani piya?",
    "क्या तुम अपने दिल की धक-धक सुनना चाहोगे? / Would you like to listen to your heartbeat? / Kya tum apne dil ki dhak-dhak sunna chahoge?"]);
  follow("feelings", ["अब मन कैसा है? / How do you feel now? / Ab mann kaisa hai?",
    "क्या मैं तुम्हें एक चुटकुला सुनाऊँ? / Shall I tell you a joke? / Kya main tumhe ek chutkula sunaun?",
    "तुम्हें किस चीज़ से सबसे ज़्यादा खुशी मिलती है? / What makes you the happiest? / Tumhe kis cheez se sabse zyada khushi milti hai?"]);
  follow("family", ["तुम्हारे घर में सबसे ज़्यादा कौन हँसाता है? / Who makes you laugh the most at home? / Tumhare ghar mein sabse zyada kaun hansata hai?",
    "आज तुमने किसके साथ खेला? / Who did you play with today? / Aaj tumne kiske saath khela?",
    "तुम दोस्तों के साथ कौन सा खेल खेलते हो? / What game do you play with your friends? / Tum doston ke saath kaun sa khel khelte ho?"]);
  follow("safety", ["तुम कितने समझदार हो! और कुछ पूछना है? / You're so sensible! Anything else you want to ask? / Tum kitne samajhdaar ho! Aur kuch poochhna hai?",
    "क्या तुम ट्रैफ़िक लाइट के तीन रंग बता सकते हो? / Can you name the three traffic light colours? / Kya tum traffic light ke teen rang bata sakte ho?"]);
  follow("time", ["तुम्हें कौन सा मौसम सबसे अच्छा लगता है? / Which season do you like best? / Tumhe kaun sa mausam sabse achha lagta hai?",
    "तुम्हें सुबह अच्छी लगती है या शाम? / Do you like mornings or evenings more? / Tumhe subah achhi lagti hai ya shaam?",
    "आज तुमने सबसे पहले क्या किया? / What did you do first today? / Aaj tumne sabse pehle kya kiya?"]);
  follow("numbers", ["तुम दस तक गिनकर दिखाओगे? / Can you count to ten for me? / Tum das tak ginkar dikhaoge?",
    "तुम्हारे आसपास कोई गोल चीज़ है? / Is there something round near you? / Tumhare aas-paas koi gol cheez hai?",
    "तुम्हारा पसंदीदा रंग कौन सा है? / What is your favourite colour? / Tumhara favourite rang kaun sa hai?"]);
  follow("india", ["तुम्हें कौन सा त्योहार सबसे अच्छा लगता है? / Which festival do you like the most? / Tumhe kaun sa tyohaar sabse achha lagta hai?",
    "तुमने कभी मोर देखा है? / Have you ever seen a peacock? / Tumne kabhi mor dekha hai?",
    "तुम्हें कौन सी मिठाई पसंद है? / Which sweet do you like? / Tumhe kaun si mithai pasand hai?"]);
  follow("science", ["अगर तुम्हारे पास एक रोबोट हो, तो वो क्या करेगा? / If you had a robot, what would it do? / Agar tumhare paas ek robot ho, toh woh kya karega?",
    "तुम बड़े होकर रॉकेट में उड़ना चाहोगे? / Would you like to fly in a rocket one day? / Tum bade hokar rocket mein udna chahoge?",
    "चलो, आज घर में एक चीज़ बचाएँ — पानी या बिजली? / Shall we save something at home today — water or electricity? / Chalo, aaj ghar mein ek cheez bachayein — paani ya bijli?"]);
  follow("jobs", ["तुम बड़े होकर क्या बनना चाहोगे? / What would you like to be when you grow up? / Tum bade hokar kya banna chahoge?",
    "तुम घर में किसकी मदद करते हो? / Who do you help at home? / Tum ghar mein kiski madad karte ho?"]);
  follow("fun", ["एक और सुनोगे? / Want one more? / Ek aur sunoge?",
    "अब तुम मुझे कुछ मज़ेदार सुनाओगे? / Now will you tell me something funny? / Ab tum mujhe kuch mazedaar sunaoge?"]);
  follow("buddy", ["अब तुम बताओ, तुम्हें क्या करना सबसे अच्छा लगता है? / Now you tell me — what do you love doing most? / Ab tum batao, tumhe kya karna sabse achha lagta hai?",
    "चलो, साथ में कोई खेल खेलें? / Shall we play a game together? / Chalo, saath mein koi khel khelein?"]);

  /* ================= Matching ================= */

  function r01Of(rnd) { return function () { var x = +rnd(); return x >= 0 && x < 1 ? x : 0; }; }
  function pickOf(r01) { return function (arr) { return arr[Math.min(arr.length - 1, Math.floor(r01() * arr.length))]; }; }

  /* Question words ("why", "क्या") only say that something is asked; they weigh less than topic words. */
  var CUE_KEYS = {};
  MACRO.Q.concat(MACRO.LIKE).forEach(function (c) { CUE_KEYS[c.key] = 1; });
  function matcher(t) {
    var memo = {};
    function len(c) {
      if (!Object.prototype.hasOwnProperty.call(memo, c.key)) memo[c.key] = kwTest(c, t) ? c.len : 0;
      return memo[c.key];
    }
    /* best(group) → score of the best matching keyword (0 = none). */
    return function best(g) {
      var b = 0;
      for (var i = 0; i < g.length; i++) {
        var l = len(g[i]);
        if (l) { var sc = CUE_KEYS[g[i].key] ? 3 : 4 + Math.min(l, 12); if (sc > b) b = sc; }
      }
      return b;
    };
  }

  /* → {it, score} or null. All groups must match; longer (more specific) keywords and more groups win. */
  function match(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim() || raw.length > 400) return null;
    var t = norm(raw);
    if (!t) return null;
    var best = matcher(t);
    if (best(MACRO.GUARD)) return null;                      // hurt / emergency: the safety layer answers
    if (/\d{6,}/.test(t.replace(/\s+/g, ""))) return null;  // looks like a phone number: never repeat it
    var isQ = /[?？]/.test(raw) || best(MACRO.Q) > 0;
    var cue = isQ || best(MACRO.LIKE) > 0;
    var nWords = t.split(" ").length;
    var top = null, topScore = 0;
    for (var i = 0; i < INTENTS.length; i++) {
      var it = INTENTS[i];
      if (it.cue && !cue) continue;
      if (nWords > 18 && it.groups.length < 2) continue;    // a long story with one topic word is not a question
      var s = 0;
      for (var g = 0; g < it.groups.length; g++) {
        var l = best(it.groups[g]);
        if (!l) { s = -1; break; }
        s += l;
      }
      if (s < 0 || (it.neg && best(it.neg)) || (it.need && !it.need(t))) continue;
      if (it.sens) s += 6;
      if (it.bonus) s += it.bonus;
      if (s > topScore) { top = it; topScore = s; }
    }
    return top ? { it: top, score: topScore, t: t, isQ: isQ } : null;
  }

  /* ================= Composing a reply ================= */

  /* Split after . ! ? । — an emoji right after the punctuation stays with its sentence. */
  var LEAD_EMOJI = /^((?:[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{FE0F}\u{200D}\u{20E3}]+\s*)+)/u;
  function sentences(s) {
    var out = [];
    String(s).split(/(?<=[.!?।])\s+/).forEach(function (p) {
      if (!p) return;
      if (out.length) {
        var m = p.match(LEAD_EMOJI);
        if (m) { out[out.length - 1] += " " + m[1].trim(); p = p.slice(m[1].length); }
      }
      if (!p) return;
      if (/[\p{L}\p{N}]/u.test(p) || !out.length) out.push(p); else out[out.length - 1] += " " + p;
    });
    return out;
  }
  function ageOf(a) { return a === "2-3" ? 0 : a === "6+" ? 2 : 1; }

  function compose(it, opts, t, isQ) {
    opts = opts || {};
    var lang = LANGS.indexOf(opts.lang) >= 0 ? opts.lang : "hi";
    var age = ageOf(opts.ageBand);
    var r01 = r01Of(typeof opts.random === "function" ? opts.random : Math.random);
    var pick = pickOf(r01);
    var body;
    if (it.fn) { body = it.fn(t || "", lang); if (!body) return null; }
    else body = pick(it.a[lang].length ? it.a[lang] : it.a.hi);
    var ss = sentences(body);
    var keep = it.sens || it.whole;
    var cap = age === 0 && !keep ? MAX_YOUNG : MAX;   // safety words and punchlines are never cut
    var maxS = age === 0 ? (keep ? 2 : 1) : age === 1 ? (keep ? 3 : 2) : 3;
    var out = [ss[0]];
    for (var i = 1; i < ss.length && out.length < maxS; i++) {
      if ((out.join(" ") + " " + ss[i]).length > cap) break;
      out.push(ss[i]);
    }
    if (age === 0 && out.length === 1 && ss.length > 1 && (out[0] + " " + ss[1]).length <= YOUNG_TWO) out.push(ss[1]);
    var lead = r01();
    if (!keep && LEAD_CATS[it.cat] && out.length < (age === 0 ? 2 : 3) && lead < 0.45) {
      var li = pick(isQ ? LEAD_Q : LEAD_S)[lang];
      if ((li + " " + out.join(" ")).length <= (age === 0 ? YOUNG_TWO : MAX)) out.unshift(li);
    }
    var text = out.join(" ");
    if (text.length > MAX) text = text.slice(0, MAX - 1) + "…";
    var res = { text: text, topic: "know:" + it.id, intent: it.id, category: it.cat, lang: lang };
    if (!it.sens && it.f !== false) {
      var f = it.f || (FOLLOW[it.cat] ? pick(FOLLOW[it.cat]) : null);
      if (f && f[lang]) res.followUp = f[lang];
    }
    return res;
  }

  function answer(text, opts) {
    try {
      var m = match(text);
      return m ? compose(m.it, opts, m.t, m.isQ) : null;
    } catch (e) {
      return null;   // never break the conversation: other layers will reply
    }
  }

  var Knowledge = {
    answer: answer,
    normalize: norm,
    MAX_REPLY: MAX,
    MAX_YOUNG: MAX_YOUNG,
    count: INTENTS.length,
    categories: CATS,
    intents: function () { return INTENTS.map(function (it) { return it.id; }); },
    /* for tests and tools */
    _match: function (text) { var m = match(text); return m ? { id: m.it.id, score: m.score } : null; },
    _compose: function (id, opts, text) { var it = BY_ID[id]; return it ? compose(it, opts, text ? norm(text) : "", true) : null; },
    _raw: function (id) { var it = BY_ID[id]; return it ? { a: it.a, f: it.f, cat: it.cat, sens: it.sens, computed: !!it.fn } : null; },
    _follow: FOLLOW,
    _sentences: sentences,
  };
  if (root) { root.NS = root.NS || {}; root.NS.Knowledge = Knowledge; }
  if (typeof module !== "undefined" && module.exports) module.exports = Knowledge;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
