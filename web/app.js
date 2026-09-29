/* ---------------- Syllabus data (mirrors the app) ---------------- */
const PALETTE = ["#EF5350","#AB47BC","#5C6BC0","#29B6F6","#26A69A","#66BB6A","#9CCC65","#FFA726","#FF7043","#8D6E63","#EC407A","#7E57C2","#42A5F5"];

const ABC = [["A","Apple","🍎"],["B","Ball","⚽"],["C","Cat","🐈"],["D","Dog","🐕"],["E","Elephant","🐘"],["F","Fish","🐟"],["G","Grapes","🍇"],["H","Hat","🎩"],["I","Ice cream","🍦"],["J","Juice","🧃"],["K","Kite","🪁"],["L","Lion","🦁"],["M","Monkey","🐒"],["N","Nest","🪺"],["O","Orange","🍊"],["P","Parrot","🦜"],["Q","Queen","👑"],["R","Rabbit","🐇"],["S","Sun","☀️"],["T","Tiger","🐯"],["U","Umbrella","☂️"],["V","Van","🚐"],["W","Watch","⌚"],["X","Xylophone","🎶"],["Y","Yak","🐂"],["Z","Zebra","🦓"]];
const VARN = [["अ","अनार","🍎"],["आ","आम","🥭"],["इ","इमली","🌿"],["ई","ईख","🌾"],["उ","उल्लू","🦉"],["ऊ","ऊन","🧶"],["ए","एड़ी","🦶"],["ऐ","ऐनक","👓"],["ओ","ओखली","🪵"],["औ","औरत","👩"],["अं","अंगूर","🍇"],["क","कमल","🌸"],["ख","खरगोश","🐇"],["ग","गमला","🪴"],["घ","घड़ी","⌚"],["च","चम्मच","🥄"],["छ","छाता","☂️"],["ज","जहाज़","✈️"],["झ","झंडा","🚩"],["ट","टमाटर","🍅"],["ठ","ठठेरा","🔨"],["ड","डमरू","🥁"],["ढ","ढोल","🥁"],["त","तितली","🦋"],["थ","थाली","🍽️"],["द","दवात","🖋️"],["ध","धनुष","🏹"],["न","नल","🚰"],["प","पतंग","🪁"],["फ","फल","🍎"],["ब","बकरी","🐐"],["भ","भालू","🐻"],["म","मछली","🐟"],["य","यंत्र","⚙️"],["र","रथ","🛕"],["ल","लट्टू","🪀"],["व","वन","🌳"],["श","शेर","🦁"],["स","सेब","🍎"],["ह","हाथी","🐘"],["क्ष","क्षत्रिय","🛡️"],["त्र","त्रिशूल","🔱"],["ज्ञ","ज्ञानी","📖"]];
const NUMW = ["एक","दो","तीन","चार","पाँच","छह","सात","आठ","नौ","दस"];
const NUME = ["One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];

function card(big, cap, speak, lang, bg){ return {big, cap, speak, lang, bg}; }

function englishAbc(){ return ABC.map(r => card(r[0], r[0]+" for "+r[1]+"  "+r[2], r[0]+" for "+r[1], "en")); }
function hindiVarn(){ return VARN.map(r => card(r[0], r[0]+" से "+r[1]+"  "+r[2], r[0]+" से "+r[1], "hi")); }
function numbers(){ return NUMW.map((w,i)=>{ const n=i+1; return card(String(n), "🍎".repeat(n)+"\n"+w+" · "+NUME[i], w, "hi"); }); }
function colors(){ return [
  card("🔴","लाल · Red","लाल","hi","#E53935"),card("🟢","हरा · Green","हरा","hi","#43A047"),
  card("🔵","नीला · Blue","नीला","hi","#1E88E5"),card("🟡","पीला · Yellow","पीला","hi","#FDD835"),
  card("🟠","नारंगी · Orange","नारंगी","hi","#FB8C00"),card("🟣","बैंगनी · Purple","बैंगनी","hi","#8E24AA"),
  card("🟤","भूरा · Brown","भूरा","hi","#6D4C41"),card("⚫","काला · Black","काला","hi","#212121"),
  card("⚪","सफ़ेद · White","सफ़ेद","hi","#FAFAFA"),card("🌸","गुलाबी · Pink","गुलाबी","hi","#EC407A")]; }
function shapes(){ return [card("⭕","वृत्त · Circle","वृत्त","hi"),card("🟥","वर्ग · Square","वर्ग","hi"),card("🔺","त्रिकोण · Triangle","त्रिकोण","hi"),card("⭐","तारा · Star","तारा","hi"),card("❤️","दिल · Heart","दिल","hi"),card("🔷","हीरा · Diamond","हीरा","hi")]; }
function animals(){ return [
  card("🐄","गाय · Cow","गाय बोलती है, मूँ मूँ","hi"),card("🐕","कुत्ता · Dog","कुत्ता बोलता है, भौं भौं","hi"),
  card("🐈","बिल्ली · Cat","बिल्ली बोलती है, म्याऊँ म्याऊँ","hi"),card("🦁","शेर · Lion","शेर दहाड़ता है, दहाड़","hi"),
  card("🐐","बकरी · Goat","बकरी बोलती है, में में","hi"),card("🐓","मुर्गा · Rooster","मुर्गा बोलता है, कुकड़ूँ कूँ","hi"),
  card("🐘","हाथी · Elephant","हाथी बहुत बड़ा होता है","hi"),card("🐒","बंदर · Monkey","बंदर पेड़ पर कूदता है","hi"),
  card("🐸","मेंढक · Frog","मेंढक बोलता है, टर्र टर्र","hi"),card("🐦","चिड़िया · Bird","चिड़िया बोलती है, चूँ चूँ","hi")]; }
function fruits(){ return [card("🍎","सेब · Apple","सेब","hi"),card("🍌","केला · Banana","केला","hi"),card("🥭","आम · Mango","आम","hi"),card("🍇","अंगूर · Grapes","अंगूर","hi"),card("🍊","संतरा · Orange","संतरा","hi"),card("🍉","तरबूज़ · Watermelon","तरबूज़","hi"),card("🥕","गाजर · Carrot","गाजर","hi"),card("🍅","टमाटर · Tomato","टमाटर","hi"),card("🥔","आलू · Potato","आलू","hi"),card("🧅","प्याज़ · Onion","प्याज़","hi")]; }
function vehicles(){ return [card("🚗","कार · Car","कार","hi"),card("🚌","बस · Bus","बस","hi"),card("🚂","रेलगाड़ी · Train","रेलगाड़ी","hi"),card("✈️","हवाई जहाज़ · Aeroplane","हवाई जहाज़","hi"),card("🚲","साइकिल · Cycle","साइकिल","hi"),card("🛺","ऑटो · Auto","ऑटो रिक्शा","hi"),card("⛵","नाव · Boat","नाव","hi"),card("🚑","एम्बुलेंस · Ambulance","एम्बुलेंस","hi")]; }
function bodyParts(){ return [card("👁️","आँख · Eye","आँख, इससे हम देखते हैं","hi"),card("👂","कान · Ear","कान, इससे हम सुनते हैं","hi"),card("👃","नाक · Nose","नाक, इससे हम सूँघते हैं","hi"),card("👄","मुँह · Mouth","मुँह, इससे हम बोलते और खाते हैं","hi"),card("✋","हाथ · Hand","हाथ, इससे हम काम करते हैं","hi"),card("🦶","पैर · Foot","पैर, इससे हम चलते हैं","hi"),card("🦷","दाँत · Teeth","दाँत, इनसे हम चबाते हैं","hi"),card("💇","बाल · Hair","बाल","hi")]; }
function manners(){ return [card("🙏","नमस्ते","बड़ों को नमस्ते कहते हैं","hi"),card("😊","धन्यवाद","कोई कुछ दे तो धन्यवाद कहते हैं","hi"),card("🙂","कृपया","कुछ माँगते समय कृपया कहते हैं","hi"),card("🤝","माफ़ करना","गलती हो जाए तो माफ़ी माँगते हैं","hi"),card("🪥","ब्रश करो","सुबह उठकर दाँत साफ़ करते हैं","hi"),card("🧼","हाथ धोओ","खाने से पहले हाथ धोते हैं","hi"),card("🍎","फल खाओ","हरी सब्ज़ी और फल खाने से हम मज़बूत बनते हैं","hi"),card("😴","जल्दी सोओ","रात को जल्दी सोते हैं और सुबह जल्दी उठते हैं","hi")]; }

const LESSONS = [
  {icon:"🔤", title:"ABC", get:englishAbc, lang:"en", say:"अंग्रेज़ी अक्षर"},
  {icon:"अ", title:"अक्षर", get:hindiVarn, lang:"hi", say:"हिंदी वर्णमाला"},
  {icon:"🔢", title:"गिनती", get:numbers, lang:"hi", say:"एक दो तीन, गिनती सीखो"},
  {icon:"🎨", title:"रंग", get:colors, lang:"hi", say:"रंगों के नाम सीखो"},
  {icon:"🔷", title:"आकार", get:shapes, lang:"hi", say:"आकार सीखो"},
  {icon:"🐘", title:"जानवर", get:animals, lang:"hi", say:"जानवर और उनकी आवाज़"},
  {icon:"🍎", title:"फल-सब्ज़ी", get:fruits, lang:"hi", say:"फल और सब्ज़ियाँ"},
  {icon:"🚗", title:"वाहन", get:vehicles, lang:"hi", say:"गाड़ियों के नाम"},
  {icon:"✋", title:"शरीर", get:bodyParts, lang:"hi", say:"शरीर के अंग"},
  {icon:"🙏", title:"अच्छी बातें", get:manners, lang:"hi", say:"प्यार से बोलना सीखो"},
];

const RHYMES = [
  {title:"मछली जल की रानी 🐟", lang:"hi", lines:["मछली जल की रानी है,","जीवन उसका पानी है।","हाथ लगाओ डर जाएगी,","बाहर निकालो मर जाएगी।"]},
  {title:"आलू कचालू 🥔", lang:"hi", lines:["आलू कचालू बेटा कहाँ गए थे?","बैंगन की टोकरी में सो रहे थे।","बैंगन ने लात मारी रो रहे थे,","मम्मी ने प्यार किया हँस रहे थे।"]},
  {title:"चंदा-तारे 🌙", lang:"hi", lines:["चंदा चमके, तारे चमकें,","आसमान में झिलमिल दमकें।","नन्हे-मुन्ने, अब सो जाओ,","मीठे-मीठे सपने पाओ।"]},
  {title:"हाथी दादा 🐘", lang:"hi", lines:["हाथी दादा, बड़े निराले,","सूँड़ हिलाकर पानी डाले।","कान हिलाएँ पंखे जैसे,","चलें झूमते, मस्त मतवाले।"]},
  {title:"नाचे मोर 🦚", lang:"hi", lines:["काले बादल, रिमझिम पानी,","मोर ने छेड़ी नई कहानी।","पंख फैलाकर छम-छम नाचा,","देख के ख़ुश हैं दादी-नानी।"]},
  {title:"Twinkle Twinkle ⭐", lang:"en", lines:["Twinkle, twinkle, little star,","How I wonder what you are.","Up above the world so high,","Like a diamond in the sky."]},
  {title:"Johny Johny 👶", lang:"en", lines:["Johny, Johny, yes papa?","Eating sugar? No, papa.","Telling lies? No, papa.","Open your mouth, ha ha ha!"]},
  {title:"Baa Baa Black Sheep 🐑", lang:"en", lines:["Baa, baa, black sheep,","Have you any wool?","Yes sir, yes sir,","Three bags full."]},
  {title:"Jack and Jill 🪣", lang:"en", lines:["Jack and Jill went up the hill,","To fetch a pail of water.","Jack fell down and broke his crown,","And Jill came tumbling after."]},
];

/* ---------------- Speech ---------------- */
let soundOn = true;
let voices = [];
function loadVoices(){ try { voices = window.speechSynthesis.getVoices() || []; } catch(e){ voices = []; } }
loadVoices();
if (window.speechSynthesis) { window.speechSynthesis.onvoiceschanged = loadVoices; }

function clean(t){ return (t||"").replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu," ").replace(/·/g," ").replace(/\s+/g," ").trim(); }
/* On-device voices first: with a network voice the browser sends the text (which can include
   the child's name from the chat) to an online speech service. A network voice is used only
   when the phone has no local voice for that language. */
function pickVoice(lang){
  const pref = lang === "en" ? "en" : "hi";
  const byLang = voices.filter(v => v.lang && v.lang.toLowerCase().replace("_", "-").startsWith(pref));
  const byName = pref === "hi" ? voices.filter(v => /hindi|हिन्दी|हिंदी/i.test(v.name || "")) : [];
  const local = v => v.localService === true;
  return byLang.find(local) || byName.find(local) || byLang[0] || byName[0] || null;
}
function speak(text, lang){
  if (!soundOn || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean(text));
    u.lang = lang === "en" ? "en-US" : "hi-IN";
    const v = pickVoice(lang); if (v) u.voice = v;
    u.rate = 0.9; u.pitch = 1.2;
    window.speechSynthesis.speak(u);
  } catch(e){}
}
function speakLines(lines, lang){ speak(lines.join(", "), lang); }
function stopSpeak(){ try { window.speechSynthesis.cancel(); } catch(e){} }

/* ---------------- Router / UI ---------------- */
const body = document.getElementById("body");
const backBtn = document.getElementById("backBtn");
const soundBtn = document.getElementById("soundBtn");
const scrTitle = document.getElementById("scrTitle");
const prog = document.getElementById("prog");

soundBtn.onclick = () => { soundOn = !soundOn; soundBtn.textContent = soundOn ? "🔊" : "🔇"; if(!soundOn) stopSpeak(); };
backBtn.onclick = () => goHome();

let onHome = false;
function setTop(title, showBack){ scrTitle.textContent = title; backBtn.hidden = !showBack; prog.textContent = ""; onHome = !showBack; }
/* The only element builder in the app. It sets text, never HTML, so nothing typed by the child
   or sent by the server can ever become markup. Nothing in this file parses HTML strings. */
function el(tag, cls, text){ const e = document.createElement(tag); if(cls) e.className = cls; if(text!=null) e.textContent = text; return e; }

function goHome(){
  stopSpeak();
  setTop("😊 नन्हा स्कूल", false);
  body.replaceChildren();
  const head = el("div","homehead");
  head.append(el("h2", null, "😊 नन्हा स्कूल"), el("p", null, "किसी भी तस्वीर पर दबाओ और सीखो 👇"));
  body.appendChild(head);
  const grid = el("div","grid");
  const items = [];
  LESSONS.forEach((l,i)=> items.push({icon:l.icon, label:l.title, color:PALETTE[i%PALETTE.length], act:()=>openLesson(l)}));
  items.push({icon:"🎵", label:"कविताएँ", color:PALETTE[10], act:openRhymes});
  items.push({icon:"🎮", label:"खेल", color:PALETTE[11], act:openQuiz});
  items.push({icon:"💬", label:"बात करो", color:PALETTE[12], act:openChat});
  items.forEach(it=>{
    const locked = isLocked(it.label);
    const b = el("button","tile" + (locked ? " locked" : "")); b.style.background = it.color;
    b.appendChild(el("span","ic",it.icon));
    b.appendChild(el("span","lb",it.label));
    if (locked) b.appendChild(el("span","lock","🔒"));
    b.onclick = () => { if (locked) { askGrownUp(); return; } speak(it.label, "hi"); it.act(); };
    grid.appendChild(b);
  });
  body.appendChild(grid);
  const banner = statusBanner();
  if (banner) body.appendChild(banner);
}

function openLesson(lesson){
  const cards = lesson.get();
  let idx = 0;
  setTop(lesson.title, true);
  speak(lesson.say, lesson.lang);
  body.replaceChildren();
  const wrap = el("div","cardwrap");
  const card = el("div","card");
  const big = el("div","big");
  const cap = el("div","cap");
  const hint = el("div","taphint","🔊 सुनने के लिए तस्वीर दबाओ");
  card.append(big, cap, hint);
  card.onclick = () => sayCurrent();
  const nav = el("div","navrow");
  const prev = el("button","navbtn","◀ पीछे"); prev.style.background = "#9E9E9E";
  const next = el("button","navbtn","आगे ▶"); next.style.background = "#2EAD6B";
  prev.onclick = () => show(idx-1);
  next.onclick = () => show(idx+1);
  nav.append(prev, next);
  wrap.append(card, nav);
  body.appendChild(wrap);

  function sayCurrent(){ const c = cards[idx]; if(c) speak(c.speak, c.lang || lesson.lang); }
  function show(i){
    if (i < 0) return;
    if (i >= cards.length){
      card.style.background = "#C8F0D8";
      big.textContent = "🥳"; big.className = "big";
      cap.textContent = "🎉 शाबाश! तुमने पूरा कर लिया! 🌟";
      prog.textContent = "";
      speak("शाबाश! तुमने पूरा कर लिया। बहुत बढ़िया!", "hi");
      return;
    }
    idx = i; const c = cards[i];
    card.style.background = c.bg || "#FFFFFF";
    const dark = c.bg ? isDark(c.bg) : false;
    cap.style.color = dark ? "#fff" : "var(--ink)";
    hint.style.color = dark ? "rgba(255,255,255,.8)" : "var(--muted)";
    big.textContent = c.big;
    big.className = "big" + ([...c.big].length <= 3 && !c.big.includes("\n") ? "" : " small");
    cap.textContent = c.cap;
    prog.textContent = (i+1) + "/" + cards.length;
    sayCurrent();
  }
  show(0);
}

function isDark(hex){
  const n = parseInt(hex.slice(1),16); const r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  return (0.299*r + 0.587*g + 0.114*b) < 140;
}

function openRhymes(){
  stopSpeak();
  setTop("🎵 कविताएँ", true);
  body.replaceChildren();
  const list = el("div","rlist");
  RHYMES.forEach((r,i)=>{
    const locked = rhymeLocked(i);
    const b = el("button","rbtn" + (locked ? " locked" : ""), (locked ? "🔒 " : "") + r.title);
    b.style.background = PALETTE[i%PALETTE.length];
    b.onclick = () => locked ? askGrownUp() : playRhyme(r);
    list.appendChild(b);
  });
  body.appendChild(list);
}
function playRhyme(r){
  setTop(r.title.replace(/\s*\S+$/, m=>m), true);
  scrTitle.textContent = r.title;
  body.replaceChildren();
  const p = el("div","rplayer");
  const words = el("div","rwords", r.lines.join("\n"));
  const nav = el("div","navrow");
  const play = el("button","navbtn","▶ सुनो"); play.style.background = "#2EAD6B";
  const stop = el("button","navbtn","⏹ रुको"); stop.style.background = "#EF5350";
  play.onclick = () => speakLines(r.lines, r.lang);
  stop.onclick = stopSpeak;
  nav.append(play, stop);
  const back = el("button","navbtn","⬅ और कविताएँ"); back.style.background = "#7E57C2"; back.style.margin = "0 12px 12px";
  back.onclick = openRhymes;
  p.append(words, nav, back);
  body.appendChild(p);
  speakLines(r.lines, r.lang);
}

/* Quiz */
const QUIZ_POOL = [].concat(animals(), fruits(), vehicles(), colors(), shapes());
let stars = 0;
function plainName(cap){ return cap.split("·")[0].trim(); }
function openQuiz(){
  stars = 0;
  setTop("🎮 खेल", true);
  body.replaceChildren();
  const q = el("div","quiz");
  const qt = el("div","qtext");
  const opts = el("div","opts");
  q.append(qt, opts);
  body.appendChild(q);
  let answer = null;
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function next(){
    prog.textContent = "⭐ " + stars;
    answer = QUIZ_POOL[Math.floor(Math.random()*QUIZ_POOL.length)];
    const choices = [answer];
    let guard = 0;
    while (choices.length < 3 && guard++ < 60){
      const c = QUIZ_POOL[Math.floor(Math.random()*QUIZ_POOL.length)];
      if (!choices.some(x=>x.big===c.big)) choices.push(c);
    }
    shuffle(choices);
    const name = plainName(answer.cap);
    qt.textContent = name + " कहाँ है? 👆";
    speak(name + " कहाँ है?", "hi");
    opts.replaceChildren();
    choices.forEach(c=>{
      const b = el("button","opt", c.big);
      b.onclick = () => {
        if (c.big === answer.big){
          stars++; prog.textContent = "⭐ " + stars;
          const cheers = ["शाबाश! 🌟","बहुत बढ़िया! 🎉","एकदम सही! 👏","वाह! 🥳"];
          const ch = cheers[Math.floor(Math.random()*cheers.length)];
          qt.textContent = ch;
          speak(ch + " " + plainName(answer.cap), "hi");
          setTimeout(next, 1300);
        } else {
          qt.textContent = "फिर से कोशिश करो 🙂";
          speak("फिर से कोशिश करो", "hi");
        }
      };
      opts.appendChild(b);
    });
  }
  next();
}

/* Chat — a small taste of the talking buddy (typed, offline) */
let kidName = null;
function buddyReply(input){
  const t = input.toLowerCase().replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x0966)).replace(/[?!,।]/g," ").replace(/\s+/g," ").trim();
  const has = (...ks) => ks.some(k => (k.length<=3 ? (" "+t+" ").includes(" "+k+" ") : t.includes(k)));
  const m = t.match(/(\d+)\s*(\+|plus|जमा|और|-|minus|घटा|x|×|\*|times|गुणा|\/|÷|भाग)\s*(\d+)/);
  if (m){ const a=+m[1], b=+m[3], o=m[2]; let r,s;
    if (["+","plus","जमा","और"].includes(o)){r=a+b;s="+";}
    else if (["-","minus","घटा"].includes(o)){r=a-b;s="−";}
    else if (["/","÷","भाग"].includes(o)){ if(b===0) return "शून्य से भाग नहीं दे सकते! 🎩"; s="÷"; r=Math.floor(a/b); if(a%b) return a+" ÷ "+b+" = "+r+", और शेष "+(a%b)+" बचता है। 🧮"; }
    else {r=a*b;s="×";}
    return a+" "+s+" "+b+" = "+r+" 🧮 शाबाश!"; }
  const nm = t.match(/(?:मेरा नाम|mera naam|my name is)\s+([^\s]+)/);
  if (nm){ kidName = nm[1]; return "कितना प्यारा नाम है, "+kidName+"! 🌈 बोलो, चुटकुला, कहानी या पहेली?"; }
  if (has("वो मुझे मारा","मारता","पीटता","hits me","hurt me")) return "ये सुनकर चिंता हुई। 💛 ये तुम्हारी गलती नहीं है। किसी भरोसेमंद बड़े को बताओ, और चाइल्डलाइन 1098 पर फ़ोन कर सकते हो।";
  if (has("उदास","दुखी","रोना","sad","डर")) return "कोई बात नहीं दोस्त 🤗 गहरी साँस लो — एक, दो, तीन। मम्मी-पापा से बात करो। एक चुटकुला सुनाऊँ?";
  if (has("चुटकुला","जोक","joke")) return "टीचर: सबसे पुराना जानवर कौन?\nबच्चा: ज़ेबरा! क्योंकि वो अभी भी ब्लैक एंड व्हाइट है! 😄";
  if (has("कहानी","story")) return "एक प्यासा कौआ था 🐦 उसने घड़े में कंकड़ डाले, पानी ऊपर आया और उसने पानी पिया! सीख: कोशिश करने वालों की हार नहीं होती! 💪";
  if (has("पहेली","riddle")) return "पहेली: ऐसी क्या चीज़ है जो जितनी बड़ी हो उतनी कम दिखे? 🤔 (जवाब: अँधेरा! 🌑)";
  if (has("नमस्ते","हेलो","hello","hi","namaste")) return "नमस्ते"+(kidName?" "+kidName:"")+"! 😊 आज तुम्हारा दिन कैसा रहा?";
  if (has("कैसे हो","कैसी हो","how are you")) return "मैं एकदम बढ़िया हूँ! 😄 तुम कैसे हो?";
  if (has("मेरा नाम क्या","my name")) return kidName ? "तुम्हारा नाम "+kidName+" है! 😊" : "तुमने अभी नाम नहीं बताया! बोलो 'मेरा नाम ... है'।";
  if (has("बाय","bye","टाटा")) return "टाटा"+(kidName?" "+kidName:"")+"! 👋 फिर मिलेंगे!";
  if (has("गाना","song","गाओ")) return "🎵 मछली जल की रानी है, जीवन उसका पानी है! 🐟";
  return ["वाह, मज़ेदार बात है! 😊 और बताओ?","अच्छा! तुम्हें क्या पसंद है? 🎨⚽📚","मुझसे चुटकुला, कहानी, पहेली या जोड़-घटाना पूछो! 🤖"][Math.floor(Math.random()*3)];
}
function openChat(){
  stopSpeak();
  setTop("💬 बात बडी", true);
  body.replaceChildren();
  const chat = el("div","chat");
  const msgs = el("div","msgs");
  const inrow = el("div","inrow");
  const input = el("input"); input.type="text"; input.placeholder="यहाँ लिखो…"; input.maxLength = 200;
  input.autocomplete = "off"; input.spellcheck = false; // the child's words stay out of autofill and online spell-check
  const send = el("button",null,"भेजो");
  inrow.append(input, send);
  chat.append(msgs, inrow);
  body.appendChild(chat);
  function bubble(text, buddy){ const b = el("div","bub "+(buddy?"b":"k"), (buddy?"🤖 ":"")+text); msgs.appendChild(b); msgs.scrollTop = msgs.scrollHeight; }
  function buddySay(t){ bubble(t,true); speak(t,"hi"); }
  function submit(){ const v = input.value.trim(); if(!v) return; input.value=""; bubble(v,false); setTimeout(()=>buddySay(buddyReply(v)), 400); }
  send.onclick = submit;
  input.addEventListener("keydown", e=>{ if(e.key==="Enter") submit(); });
  buddySay("नमस्ते दोस्त! 👋 मैं बात बडी हूँ। मुझसे बात करो — चुटकुला, कहानी या जोड़-घटाना पूछो!");
}

/* ---------------- Subscription: 7-day free trial, then premium ----------------
   Payments stay off (everything free) until config.js has API_BASE and PUBLIC_KEY_JWK.
   The trial needs no signup or card. After it, a few lessons stay free forever and
   the rest wait behind a grown-ups' question, so a child never sees a payment screen. */
const CFG = Object.assign({
  API_BASE: "", PUBLIC_KEY_JWK: null, TRIAL_DAYS: 7, PRICE_TEXT: "",
  FREE: ["ABC", "अक्षर", "गिनती"], FREE_RHYMES: 2,
}, window.NS_CONFIG || {});
const PAYMENTS_ON = !!(CFG.API_BASE && CFG.PUBLIC_KEY_JWK && window.crypto && window.crypto.subtle);
const DAY = 86400000;
const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k, v); } catch(e){} },
  del(k){ try { localStorage.removeItem(k); } catch(e){} },
};
/* Older versions kept the parent's email here to prefill forms. Nothing personal is stored now. */
store.del("ns_email");
let subscribed = false;

/* The trial clock never runs backwards, so moving the phone's date back doesn't extend it. */
function nowMs(){
  const seen = Number(store.get("ns_seen")) || 0;
  const t = Math.max(Date.now(), seen);
  store.set("ns_seen", String(t));
  return t;
}
function trialDaysLeft(){
  let start = Number(store.get("ns_trial"));
  if (!start) { start = nowMs(); store.set("ns_trial", String(start)); }
  return Math.max(0, Math.ceil((start + CFG.TRIAL_DAYS * DAY - nowMs()) / DAY));
}
function hasAccess(){ return !PAYMENTS_ON || subscribed || trialDaysLeft() > 0; }
function isLocked(label){ return label !== "कविताएँ" && !CFG.FREE.includes(label) && !hasAccess(); }
function rhymeLocked(i){ return i >= CFG.FREE_RHYMES && !hasAccess(); }

/* A pass is "payload.signature", signed by the server; checked here with the public key. */
function fromB64url(s){
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function readPass(token){
  try {
    const [payload, sig] = String(token).split(".");
    if (!payload || !sig) return null;
    const key = await crypto.subtle.importKey("jwk", CFG.PUBLIC_KEY_JWK, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromB64url(sig), new TextEncoder().encode(payload));
    return ok ? JSON.parse(new TextDecoder().decode(fromB64url(payload))) : null;
  } catch (e) { return null; }
}
/* Saves a pass from the server if it checks out. Returns the pass while it is valid, else null. */
async function savePass(token){
  const pass = await readPass(token);
  if (!pass) return null;
  store.set("ns_pass", token);
  subscribed = pass.exp > nowMs() / 1000;
  return subscribed ? pass : null;
}
/* Re-checks the stored pass and quietly renews it near the end of the paid period.
   Returns true when what the child can open has changed. */
async function refreshEntitlement(){
  if (!PAYMENTS_ON) return false;
  const before = hasAccess() + "|" + subscribed;
  const token = store.get("ns_pass");
  const pass = token ? await readPass(token) : null;
  if (token && !pass) store.del("ns_pass");
  const t = nowMs() / 1000;
  subscribed = !!(pass && pass.exp > t);
  if (pass && pass.exp - t < 3 * 86400) {
    try { const r = await api("/api/refresh", { token }); await savePass(r.token); } catch (e) {}
  }
  return before !== hasAccess() + "|" + subscribed;
}

/* Every request to the server. Nothing personal is ever sent: no email, no phone, no name. */
async function api(path, data){
  let res;
  try {
    res = await fetch(CFG.API_BASE.replace(/\/+$/, "") + path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      credentials: "omit", cache: "no-store",
    });
  } catch (e) { throw { code: "network" }; }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw { code: out.error || "server_error" };
  return out;
}
function errorText(e){
  return ({
    network: "इंटरनेट से जुड़ें और फिर कोशिश करें।",
    not_active: "यह सब्सक्रिप्शन अभी चालू नहीं है।",
    bad_signature: "भुगतान की जाँच नहीं हो पाई।",
    too_many_requests: "बहुत बार कोशिश हुई। एक मिनट बाद फिर कोशिश करें।",
  })[e && e.code] || "कुछ गड़बड़ हुई। थोड़ी देर बाद फिर कोशिश करें।";
}
const BAD_CODE = "यह कोड सही नहीं है। कोड दोबारा जाँचें — जैसा भुगतान के बाद दिखा था, ठीक वैसा ही लिखें।";
function loadScript(src){
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject({ code: "network" });
    document.head.appendChild(s);
  });
}

/* Small builders for the grown-ups' screens (text only, like el()). */
function button(label, cls, onClick){ const b = el("button", cls, label); b.type = "button"; b.onclick = onClick; return b; }
function link(href, text){ const a = el("a", null, text); a.href = href; return a; }
function field(id, placeholder){
  const i = document.createElement("input");
  i.className = "pin"; i.id = id; i.type = "text"; i.placeholder = placeholder;
  i.autocomplete = "off"; i.spellcheck = false;
  i.setAttribute("aria-label", placeholder);
  return i;
}
function panel(title){
  stopSpeak();
  body.replaceChildren();
  const box = el("div", "panel");
  if (title) box.appendChild(el("h3", "ptitle", title));
  body.appendChild(box);
  return box;
}
function legalLinks(){
  const p = el("p", "psmall plegal");
  p.append(link("legal/privacy.html", "गोपनीयता नीति"), " · ", link("legal/terms.html", "नियम और शर्तें"));
  return p;
}
/* The restore code is random and says nothing about the family; it is all that is needed to
   bring premium back on another phone, so it is shown big with a copy button. */
function restoreCodeBlock(code){
  const out = el("p", "mono code", code); out.id = "restoreCodeOut";
  const copy = button("कोड कॉपी करें", "pbtn secondary", async () => {
    try {
      await navigator.clipboard.writeText(code);
      copy.textContent = "✓ कोड कॉपी हो गया";
    } catch (e) {
      const range = document.createRange(); range.selectNodeContents(out);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      copy.textContent = "कोड चुन लिया है — अब कॉपी करें";
    }
    setTimeout(() => { copy.textContent = "कोड कॉपी करें"; }, 2500);
  });
  copy.id = "copyCode";
  return [el("p", "psmall", "यह आपका रिस्टोर कोड है। इसे सँभालकर रखें — नए फ़ोन पर प्रीमियम वापस पाने के लिए यही चाहिए। इसमें आपकी कोई निजी जानकारी नहीं है।"), out, copy];
}

function statusBanner(){
  if (!PAYMENTS_ON) return null;
  let label = "⭐ प्रीमियम चालू है";
  if (!subscribed) {
    const left = trialDaysLeft();
    label = left > 0 ? `🎁 मुफ़्त ट्रायल: ${left} दिन बाकी · बड़ों के लिए` : "🔒 कुछ पाठ बंद हैं · बड़ों के लिए: पूरा ऐप खोलें";
  }
  return button(label, "banner", () => parentGate(paywall));
}

function askGrownUp(){
  parentGate(paywall);
  speak("ये खोलने के लिए मम्मी या पापा को बुलाओ", "hi");
}

/* A question small children can't answer yet, so payments are only ever seen by grown-ups. */
function parentGate(next){
  setTop("👨‍👩‍👧 बड़ों के लिए", true);
  const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
  const box = panel("यह हिस्सा माता-पिता के लिए है");
  const answer = field("gateAnswer", "जवाब");
  answer.inputMode = "numeric";
  const msg = el("p", "pmsg", "");
  const check = () => {
    const given = Number(answer.value.replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x0966)).trim());
    if (given === a * b) { next(); return; }
    msg.textContent = "जवाब सही नहीं है। नया सवाल…";
    setTimeout(() => parentGate(next), 900);
  };
  answer.addEventListener("keydown", e => { if (e.key === "Enter") check(); });
  box.append(el("p", "plead", "आगे जाने के लिए इस सवाल का जवाब लिखें:"),
             el("p", "pq", `${a} × ${b} = ?`), answer, button("आगे", "pbtn", check), msg);
}

function paywall(){
  if (subscribed) { account(); return; }
  setTop("⭐ प्रीमियम", true);
  const left = trialDaysLeft();
  const box = panel("पूरा नन्हा स्कूल खोलें");
  const list = el("ul", "plist");
  ["सारे 10 पाठ, सारी कविताएँ, खेल और बातचीत", "कोई विज्ञापन नहीं",
   "बच्चे का कोई निजी डेटा नहीं लिया जाता", "कभी भी रद्द करें"]
    .forEach(t => list.appendChild(el("li", null, "✓ " + t)));
  box.appendChild(list);
  if (CFG.PRICE_TEXT) box.appendChild(el("p", "price", CFG.PRICE_TEXT));
  box.appendChild(el("p", "psmall", left > 0
    ? `आपके मुफ़्त ट्रायल के ${left} दिन बाकी हैं। अभी सब्सक्राइब करें — पहला भुगतान ट्रायल ख़त्म होने के बाद ही होगा। (कार्ड या UPI की पुष्टि के लिए बैंक एक छोटी राशि ले सकता है, जो अपने-आप वापस हो जाती है।)`
    : "मुफ़्त ट्रायल पूरा हो गया। सब्सक्राइब करके सारे पाठ फिर से खोलें।"));
  const msg = el("p", "pmsg", "");
  const pay = button("सब्सक्राइब करें", "pbtn", () => startCheckout(msg, pay));
  box.append(pay, msg,
    el("p", "psmall", "भुगतान Razorpay के सुरक्षित पेज पर होता है: UPI, कार्ड या नेटबैंकिंग। फ़ोन नंबर, ईमेल और कार्ड जैसी जानकारी आप सिर्फ़ उसी पेज पर भरते हैं — वह इस ऐप या हमारे सर्वर तक कभी नहीं आती।"),
    legalLinks(),
    button("पहले से सब्सक्राइब किया है? यहाँ वापस पाएँ", "plink", restoreView));
}

async function startCheckout(msg, pay){
  msg.className = "pmsg";
  pay.disabled = true;
  msg.textContent = "एक पल…";
  try {
    const { subscription_id, key_id, restore_code } = await api("/api/subscribe", { trial_days_left: trialDaysLeft() });
    if (!window.Razorpay) await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    msg.textContent = "";
    // No prefill: the parent types contact details on Razorpay's own page, so they never pass through this app.
    const checkout = new window.Razorpay({
      key: key_id,
      subscription_id,
      name: "नन्हा स्कूल",
      description: "प्रीमियम सब्सक्रिप्शन",
      theme: { color: "#FF8A3D" },
      handler: async resp => {
        msg.textContent = "भुगतान की जाँच हो रही है…";
        try {
          const r = await api("/api/verify", {
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_subscription_id: resp.razorpay_subscription_id,
            razorpay_signature: resp.razorpay_signature,
          });
          if (!(await savePass(r.token))) throw { code: "not_active" };
          store.set("ns_sub", subscription_id);
          if (restore_code) store.set("ns_restore", restore_code);
          thanks(restore_code, subscription_id);
        } catch (e) {
          // Paid, but not confirmed yet: keep the code on this phone so it can't be lost.
          if (restore_code) store.set("ns_restore", restore_code);
          checkPending(restore_code);
        }
      },
      modal: { ondismiss: () => { pay.disabled = false; msg.textContent = "भुगतान पूरा नहीं हुआ। आप फिर से कोशिश कर सकते हैं।"; } },
    });
    checkout.open();
  } catch (e) {
    pay.disabled = false;
    msg.textContent = errorText(e);
  }
}

function checkPending(code){
  setTop("⭐ प्रीमियम", true);
  const box = panel("भुगतान हो गया, जाँच बाकी है");
  box.append(el("p", "plead", "भुगतान की जाँच अभी पूरी नहीं हुई। थोड़ी देर बाद “वापस पाएँ” में यह कोड डालें।"));
  if (code) box.append(...restoreCodeBlock(code));
  box.append(button("वापस पाएँ", "pbtn", restoreView), button("ऐप पर चलें", "pbtn secondary", goHome));
}

function thanks(code, subId){
  setTop("🎉 धन्यवाद!", true);
  const box = panel("प्रीमियम चालू हो गया! 🎉");
  box.append(el("p", "plead", "अब बच्चा सारे पाठ, कविताएँ, खेल और बातचीत इस्तेमाल कर सकता है।"));
  if (code) box.append(...restoreCodeBlock(code));
  if (subId) box.append(el("p", "psmall", "सब्सक्रिप्शन ID: " + subId));
  box.append(button("ऐप पर चलें", "pbtn", goHome));
}

function restoreView(){
  setTop("🔄 वापस पाएँ", true);
  const box = panel("पहले से सब्सक्राइब किया है?");
  const code = field("restoreCode", "रिस्टोर कोड");
  code.value = store.get("ns_restore") || "";
  code.autocapitalize = "off"; code.setAttribute("autocorrect", "off"); // the code is case-sensitive
  const msg = el("p", "pmsg", "");
  const go = button("वापस पाएँ", "pbtn", async () => {
    const c = code.value.replace(/\s+/g, "");
    msg.className = "pmsg";
    if (!c) { msg.textContent = "कृपया रिस्टोर कोड लिखें।"; return; }
    go.disabled = true;
    msg.textContent = "जाँच हो रही है…";
    try {
      const r = await api("/api/restore", { restore_code: c });
      const pass = await savePass(r.token);
      if (!pass) throw { code: "not_active" };
      store.set("ns_restore", c);
      if (pass.sid) store.set("ns_sub", pass.sid);
      thanks(c, pass.sid);
    } catch (err) {
      go.disabled = false;
      msg.textContent = err && (err.code === "not_found" || err.code === "bad_request") ? BAD_CODE : errorText(err);
    }
  });
  code.addEventListener("keydown", e => { if (e.key === "Enter") go.click(); });
  const help = el("p", "psmall");
  help.append("कोड खो गया? ", link("legal/contact.html", "भुगतान की रसीद वाली जानकारी के साथ हमसे संपर्क करें"));
  box.append(el("p", "psmall", "सब्सक्राइब करने के बाद जो रिस्टोर कोड दिखा था, वही यहाँ लिखें।"), code, go, msg, help);
}

function account(){
  setTop("⭐ प्रीमियम", true);
  const box = panel("आपका प्रीमियम चालू है ⭐");
  box.appendChild(el("p", "plead", "यह अपने-आप नवीनीकृत होता है। रद्द करने पर, जितने दिनों के पैसे दिए हैं उतने दिन ऐप चलता रहेगा।"));
  const code = store.get("ns_restore");
  if (code) box.append(...restoreCodeBlock(code));
  const sid = store.get("ns_sub");
  if (sid) box.append(el("p", "psmall", "सब्सक्रिप्शन ID: " + sid));
  const msg = el("p", "pmsg", "");
  const confirmRow = el("div", "panel"); confirmRow.style.padding = "0"; confirmRow.hidden = true;
  const cancelBtn = button("सब्सक्रिप्शन रद्द करें", "pbtn danger", () => { cancelBtn.hidden = true; confirmRow.hidden = false; });
  const yes = button("हाँ, रद्द करें", "pbtn danger", async () => {
    yes.disabled = true;
    try {
      const r = await api("/api/cancel", { token: store.get("ns_pass") });
      confirmRow.hidden = true;
      msg.className = "pmsg ok";
      msg.textContent = r.ends_at
        ? `रद्द हो गया। ${new Date(r.ends_at * 1000).toLocaleDateString("hi-IN")} तक प्रीमियम चलेगा, उसके बाद पैसे नहीं कटेंगे।`
        : "रद्द हो गया। आगे से पैसे नहीं कटेंगे।";
    } catch (e) { yes.disabled = false; msg.className = "pmsg"; msg.textContent = errorText(e); }
  });
  const no = button("नहीं", "pbtn secondary", () => { confirmRow.hidden = true; cancelBtn.hidden = false; });
  confirmRow.append(el("p", "plead", "पक्का रद्द करना है?"), yes, no);
  box.append(button("ऐप पर चलें", "pbtn", goHome), cancelBtn, confirmRow, msg);
}

/* ---------------- Start ---------------- */
goHome();
refreshEntitlement().then(changed => { if (changed && onHome) goHome(); });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshEntitlement().then(changed => { if (changed && onHome) goHome(); });
});

/* ---------------- PWA: offline + install ---------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
let deferredInstall = null;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  installBtn.hidden = false;
});
installBtn.onclick = async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  try { await deferredInstall.userChoice; } catch (e) {}
  deferredInstall = null;
  installBtn.hidden = true;
};
window.addEventListener('appinstalled', () => { installBtn.hidden = true; });
