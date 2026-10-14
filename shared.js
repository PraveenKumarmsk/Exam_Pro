/* =====================================================================
   ExamPro — shared script (data, helpers, header/footer, auth state)
   Load this at the END of <body>, after the #site-header / #site-footer
   placeholders.
   ===================================================================== */

/* ---------- SAFE STORAGE (works even if localStorage is blocked) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k)    { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ---------- SITE CONTENT (managed from admin.html) ----------
   Public visitors get content.json from the server (publish by uploading the file exported
   from the admin page). The admin's own browser also holds a private DRAFT that overrides it,
   so changes can be previewed before publishing. */
const DEFAULT_CONTENT = { announcement: { on: false, id: '', text: '', link: '' }, promos: null, questions: [], tests: [], settings: { gaId: '', contactEmail: '' } };
function loadContent() {
  let c = null, draft = false;
  const d = store.get('exampro-content-draft', null);
  if (d && typeof d === 'object') { c = d; draft = true; }
  else {
    try {
      const x = new XMLHttpRequest();
      x.open('GET', 'content.json', false);
      x.setRequestHeader('Cache-Control', 'no-cache');
      x.send();
      if (x.status === 200) { c = JSON.parse(x.responseText); store.set('exampro-content-cache', c); }
    } catch (e) { /* file:// or offline */ }
    if (!c) c = store.get('exampro-content-cache', null);
  }
  const out = Object.assign({}, DEFAULT_CONTENT, c || {});
  out.announcement = Object.assign({}, DEFAULT_CONTENT.announcement, out.announcement || {});
  out.settings = Object.assign({}, DEFAULT_CONTENT.settings, out.settings || {});
  if (!Array.isArray(out.questions)) out.questions = [];
  if (!Array.isArray(out.tests)) out.tests = [];
  out.__draft = draft;
  return out;
}
const CONTENT = loadContent();

/* ---------- THEME ---------- */
(function initTheme() {
  try {
    const root = document.documentElement;
    const saved = localStorage.getItem('exampro-theme');
    if (saved) root.setAttribute('data-theme', saved);
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) root.setAttribute('data-theme', 'dark');
  } catch (e) {}
})();

/* ---------- QUESTION BANK (demo content — clearly labelled in the UI) ---------- */
function mk(id, subject, chapter, diff, q, opts, ans, exp, extra) {
  return Object.assign({ id, subject, chapter, diff, q, opts, ans, exp }, extra || {});
}

const QUESTIONS = [
  /* ===== Mathematics ===== */
  mk('m1','Mathematics','Number System','Easy','What is the smallest prime number greater than 20?',['21','23','25','29'],1,'21 = 3 × 7 and 25 = 5 × 5 are composite. 23 is divisible only by 1 and itself, so it is the smallest prime above 20.',{imp:true}),
  mk('m2','Mathematics','Number System','Medium','What is the LCM of 12 and 18?',['24','48','36','72'],2,'12 = 2² × 3 and 18 = 2 × 3². LCM = 2² × 3² = 36.'),
  mk('m3','Mathematics','Number System','Easy','What is the HCF of 36 and 48?',['6','18','24','12'],3,'36 = 2² × 3² and 48 = 2⁴ × 3. HCF = 2² × 3 = 12.'),
  mk('m4','Mathematics','Percentage','Easy','What is 20% of 250?',['50','40','60','45'],0,'20% of 250 = (20 ÷ 100) × 250 = 50.',{imp:true}),
  mk('m5','Mathematics','Percentage','Medium','A number increased by 20% becomes 144. What is the number?',['115','124','120','130'],2,'Let the number be x. x × 1.2 = 144, so x = 144 ÷ 1.2 = 120.'),
  mk('m6','Mathematics','Percentage','Easy','A student scores 360 marks out of 600. What is the percentage?',['55%','60%','65%','70%'],1,'(360 ÷ 600) × 100 = 60%.'),
  mk('m7','Mathematics','Time & Work','Medium','A can finish a work in 10 days and B can finish it in 15 days. Working together, how many days will they take?',['5 days','7 days','8 days','6 days'],3,'Combined rate = 1/10 + 1/15 = 5/30 = 1/6 of the work per day, so 6 days.'),
  mk('m8','Mathematics','Time & Work','Easy','A can complete a job in 12 days. What fraction of the job does A complete in 3 days?',['1/4','1/3','1/6','1/2'],0,'In one day A does 1/12 of the job, so in 3 days A does 3/12 = 1/4.'),
  mk('m9','Mathematics','Time & Work','Medium','6 men can complete a piece of work in 10 days. How many days will 12 men take to complete the same work?',['3 days','5 days','6 days','20 days'],1,'Total work = 6 × 10 = 60 man-days. With 12 men: 60 ÷ 12 = 5 days.'),
  mk('m10','Mathematics','Profit & Loss','Easy','A trader buys an article for ₹400 and sells it for ₹500. What is his profit percentage?',['20%','30%','25%','15%'],2,'Profit = 500 − 400 = ₹100. Profit % = (100 ÷ 400) × 100 = 25%.',{imp:true}),
  mk('m11','Mathematics','Profit & Loss','Medium','An article is sold for ₹450 at a 10% loss. What was its cost price?',['₹480','₹495','₹520','₹500'],3,'Selling price = 90% of cost price, so CP = 450 ÷ 0.9 = ₹500.'),
  mk('m12','Mathematics','Profit & Loss','Medium','The marked price of a shirt is ₹800. After a 15% discount, what is the selling price?',['₹680','₹640','₹700','₹720'],0,'Discount = 15% of 800 = ₹120. Selling price = 800 − 120 = ₹680.'),
  mk('m13','Mathematics','Geometry','Easy','What is the sum of the interior angles of a triangle?',['90°','180°','270°','360°'],1,'The three interior angles of any triangle always add up to 180°.'),
  mk('m14','Mathematics','Geometry','Easy','A rectangle has length 12 cm and breadth 5 cm. What is its area?',['17 cm²','34 cm²','30 cm²','60 cm²'],3,'Area of a rectangle = length × breadth = 12 × 5 = 60 cm².'),
  mk('m15','Mathematics','Geometry','Medium','The radius of a circle is 7 cm. What is its circumference? (Use π = 22/7)',['22 cm','44 cm','154 cm','88 cm'],1,'Circumference = 2πr = 2 × (22/7) × 7 = 44 cm.'),
  mk('m16','Mathematics','Algebra','Easy','If 3x + 5 = 20, what is the value of x?',['3','4','6','5'],3,'3x = 20 − 5 = 15, so x = 5.'),
  mk('m17','Mathematics','Algebra','Easy','(a + b)² is equal to:',['a² + b²','a² − 2ab + b²','a² + 2ab + b²','2a + 2b'],2,'Expanding (a + b)(a + b) gives a² + 2ab + b².'),
  mk('m18','Mathematics','Algebra','Medium','If x + y = 10 and x − y = 2, what is the value of x?',['4','5','6','8'],2,'Adding the two equations gives 2x = 12, so x = 6 (and y = 4).'),
  mk('m19','Mathematics','Average','Hard','The average of five numbers is 24. If one number is removed, the average of the remaining four becomes 22. What is the removed number?',['30','34','32','28'],2,'Total of five numbers = 5 × 24 = 120. Total of remaining four = 4 × 22 = 88. Removed number = 120 − 88 = 32.'),
  mk('m20','Mathematics','Speed & Distance','Hard','A train 150 m long crosses a pole in 10 seconds. What is its speed?',['45 km/h','60 km/h','72 km/h','54 km/h'],3,'Speed = 150 m ÷ 10 s = 15 m/s. In km/h: 15 × 18/5 = 54 km/h.'),

  /* ===== Reasoning ===== */
  mk('r1','Reasoning','Series','Easy','Find the next number: 2, 4, 8, 16, ?',['24','30','32','36'],2,'Each term is double the previous one: 2, 4, 8, 16, 32.'),
  mk('r2','Reasoning','Series','Easy','Find the next number: 1, 4, 9, 16, ?',['20','24','36','25'],3,'These are perfect squares: 1², 2², 3², 4², and next 5² = 25.'),
  mk('r3','Reasoning','Coding-Decoding','Easy','If CAT is coded as DBU, how is DOG coded?',['DPH','EPH','EOH','FPI'],1,'Each letter moves one step forward: C→D, A→B, T→U. So D→E, O→P, G→H, giving EPH.'),
  mk('r4','Reasoning','Coding-Decoding','Easy','If A = 1, B = 2, C = 3 and so on, what is the sum of the values of the letters in "CAB"?',['5','7','6','8'],2,'C = 3, A = 1, B = 2. Sum = 3 + 1 + 2 = 6.'),
  mk('r5','Reasoning','Blood Relations','Medium','Pointing to a man, a woman said, "He is the son of my mother\'s only son." How is the man related to the woman?',['Brother','Uncle','Nephew','Father'],2,'The woman\'s mother\'s only son is the woman\'s brother. The man is that brother\'s son, so he is the woman\'s nephew.',{imp:true}),
  mk('r6','Reasoning','Blood Relations','Medium','A is the brother of B. B is the mother of C. How is A related to C?',['Father','Maternal uncle','Grandfather','Cousin'],1,'A is the brother of C\'s mother, which makes A the maternal uncle of C.'),
  mk('r7','Reasoning','Syllogism','Medium','Statements:\nAll cats are animals.\nAll animals are living beings.\nConclusions:\nI. All cats are living beings.\nII. All living beings are cats.',['Only conclusion I follows','Only conclusion II follows','Both I and II follow','Neither I nor II follows'],0,'Cats ⊂ animals ⊂ living beings, so conclusion I follows. The reverse (II) cannot be drawn.'),
  mk('r8','Reasoning','Syllogism','Medium','Statements:\nSome pens are books.\nAll books are tables.\nConclusions:\nI. Some pens are tables.\nII. All pens are tables.',['Both I and II follow','Neither I nor II follows','Only conclusion II follows','Only conclusion I follows'],3,'The pens that are books are also tables, so "some pens are tables" follows. Only some pens are books, so "all pens are tables" does not follow.'),
  mk('r9','Reasoning','Series','Hard','Find the next number: 2, 6, 12, 20, 30, ?',['40','42','44','36'],1,'The differences are 4, 6, 8, 10, so the next difference is 12: 30 + 12 = 42.'),
  mk('r10','Reasoning','Coding-Decoding','Medium','In a certain code, TABLE is written as UBCMF. How is CHAIR written in that code?',['DIBJS','DJBIS','CIBJS','DIBKS'],0,'Each letter moves one step forward: C→D, H→I, A→B, I→J, R→S, giving DIBJS.'),

  /* ===== General Awareness ===== */
  mk('g1','General Awareness','History','Easy','Who was the first Prime Minister of India?',['Sardar Vallabhbhai Patel','Jawaharlal Nehru','Dr. Rajendra Prasad','Lal Bahadur Shastri'],1,'Jawaharlal Nehru took office as the first Prime Minister of independent India on 15 August 1947.',{imp:true}),
  mk('g2','General Awareness','History','Easy','In which year did India gain independence from British rule?',['1942','1950','1947','1935'],2,'India became independent on 15 August 1947.'),
  mk('g3','General Awareness','Geography','Easy','Which is the largest Indian state by area?',['Madhya Pradesh','Maharashtra','Rajasthan','Uttar Pradesh'],2,'Rajasthan is the largest state of India by area.'),
  mk('g4','General Awareness','Geography','Easy','What is the capital of Bihar?',['Gaya','Patna','Ranchi','Muzaffarpur'],1,'Patna is the capital city of Bihar.'),
  mk('g5','General Awareness','Polity','Medium','Who is the constitutional head of the Republic of India?',['Prime Minister','Chief Justice of India','Speaker of Lok Sabha','President'],3,'The President is the constitutional (nominal) head of the Indian State; real executive power is exercised by the Council of Ministers.'),
  mk('g6','General Awareness','Polity','Medium','On which date did the Constitution of India come into force?',['15 August 1947','26 November 1949','26 January 1950','2 October 1950'],2,'The Constitution was adopted on 26 November 1949 and came into force on 26 January 1950, celebrated as Republic Day.',{imp:true}),
  mk('g7','General Awareness','Economics','Easy','Which institution is the central bank of India?',['State Bank of India','Reserve Bank of India','NABARD','SEBI'],1,'The Reserve Bank of India (RBI) is India\'s central bank and regulates currency and credit.'),
  mk('g8','General Awareness','Economics','Easy','What is the full form of GDP?',['Gross Domestic Product','Gross Development Product','General Domestic Production','Grand Domestic Product'],0,'GDP stands for Gross Domestic Product — the total value of goods and services produced within a country.'),
  mk('g9','General Awareness','Polity','Medium','Which Article of the Indian Constitution abolishes untouchability?',['Article 14','Article 15','Article 17','Article 21'],2,'Article 17 abolishes untouchability and forbids its practice in any form.',{imp:true}),
  mk('g10','General Awareness','Geography','Medium','Which river is known as the "Sorrow of Bihar"?',['Gandak','Kosi','Sone','Bagmati'],1,'The Kosi is called the "Sorrow of Bihar" because of its frequent floods and course changes.'),

  /* ===== General Science ===== */
  mk('s1','General Science','Physics','Easy','What is the SI unit of force?',['Joule','Newton','Watt','Pascal'],1,'Force is measured in newtons (N). 1 N = 1 kg·m/s².'),
  mk('s2','General Science','Physics','Medium','What is the approximate speed of light in vacuum?',['3 × 10⁶ m/s','3 × 10⁵ m/s','3 × 10¹⁰ m/s','3 × 10⁸ m/s'],3,'Light travels at about 3 × 10⁸ m/s (roughly 3 lakh km per second) in vacuum.',{imp:true}),
  mk('s3','General Science','Chemistry','Easy','What is the chemical symbol of sodium?',['So','Sd','Na','S'],2,'The symbol Na comes from the Latin name "natrium".'),
  mk('s4','General Science','Chemistry','Medium','What is the pH of pure water at 25 °C?',['7','0','5','14'],0,'Pure water is neutral, with a pH of 7 at 25 °C.'),
  mk('s5','General Science','Biology','Easy','Which cell organelle is known as the "powerhouse of the cell"?',['Nucleus','Mitochondria','Ribosome','Golgi body'],1,'Mitochondria produce most of the cell\'s ATP (energy) through respiration.'),
  mk('s6','General Science','Biology','Medium','Which vitamin is synthesised in the skin on exposure to sunlight?',['Vitamin A','Vitamin B12','Vitamin C','Vitamin D'],3,'Sunlight (UV-B) helps the skin synthesise vitamin D.'),
  mk('s7','General Science','Chemistry','Easy','Which gas is the most abundant in Earth\'s atmosphere?',['Oxygen','Carbon dioxide','Nitrogen','Argon'],2,'Nitrogen makes up about 78% of the atmosphere; oxygen is about 21%.'),
  mk('s8','General Science','Physics','Medium','Which type of mirror is used as a rear-view mirror in vehicles?',['Concave mirror','Plane mirror','Convex mirror','Cylindrical mirror'],2,'A convex mirror gives a wider field of view and always forms an erect, diminished image.'),

  /* ===== English ===== */
  mk('e1','English','Grammar','Easy','Choose the correct word: She ___ to school every day.',['go','goes','going','gone'],1,'With a third-person singular subject ("She") in the simple present, the verb takes -s/-es: "goes".',{imp:true}),
  mk('e2','English','Grammar','Easy','Choose the correct article: I saw ___ elephant at the zoo.',['a','the','an','no article'],2,'"Elephant" begins with a vowel sound, so "an" is used.'),
  mk('e3','English','Vocabulary','Easy','Choose the synonym of "Rapid".',['Slow','Weak','Quick','Late'],2,'"Rapid" means fast, so "Quick" is its synonym.'),
  mk('e4','English','Vocabulary','Easy','Choose the antonym of "Ancient".',['Old','Historic','Antique','Modern'],3,'"Ancient" means very old; its opposite is "Modern".'),
  mk('e5','English','Reading Comprehension','Easy','According to the passage, how do plants absorb water?',['Through their leaves','Through their roots','Through their stems','Through their flowers'],1,'The passage states that plants absorb water through their roots.',{passage:'Water is essential for life. Every living thing needs water to survive. Plants absorb water through their roots, and animals drink it. Saving water is therefore everyone\'s duty.'}),
  mk('e6','English','Reading Comprehension','Easy','According to the passage, what is everyone\'s duty?',['Planting trees','Building dams','Drinking milk','Saving water'],3,'The last sentence says saving water is everyone\'s duty.',{passage:'Water is essential for life. Every living thing needs water to survive. Plants absorb water through their roots, and animals drink it. Saving water is therefore everyone\'s duty.'}),
  mk('e7','English','Cloze Test','Medium','Fill in the blank.',['have','has','had','having'],2,'The passage is in the past tense (woke up, brushed), so the correct form is "had".',{passage:'Rahul woke up early in the morning. He brushed his teeth, took a bath and ___ his breakfast.'}),
  mk('e8','English','Cloze Test','Medium','Fill in the blank.',['wait','waited','waits','waiting'],1,'The sentence describes a past event ("was late"), so the past tense "waited" is correct.',{passage:'The train was late, so we ___ for an hour at the station.'}),
  mk('e9','English','Grammar','Hard','Choose the correct option: Neither of the students ___ ready for the exam.',['are','is','were','have been'],1,'"Neither" takes a singular verb, so "is" is correct.'),
  mk('e10','English','Vocabulary','Hard','One-word substitution: A person who can speak many languages.',['Polyglot','Orator','Pedant','Novice'],0,'A polyglot is a person who knows and can use several languages.'),

  /* ===== Hindi ===== */
  mk('h1','Hindi','व्याकरण','Easy','"पुस्तक" शब्द का लिंग क्या है?',['पुल्लिंग','स्त्रीलिंग','उभयलिंग','नपुंसकलिंग'],1,'"पुस्तक" स्त्रीलिंग शब्द है (एक पुस्तक, पुस्तकें)।'),
  mk('h2','Hindi','व्याकरण','Easy','"कमल" का पर्यायवाची शब्द कौन-सा है?',['जल','नीरज','आकाश','पृथ्वी'],1,'"नीरज" (और पंकज) कमल के पर्यायवाची हैं।'),
  mk('h3','Hindi','संधि','Medium','"विद्यालय" का संधि-विच्छेद क्या है?',['विद्य + आलय','विद्या + आलय','विद् + यालय','विद्या + लय'],1,'विद्या + आलय = विद्यालय (दीर्घ स्वर संधि: आ + आ = आ)।',{imp:true}),
  mk('h4','Hindi','संधि','Medium','"सूर्योदय" का संधि-विच्छेद क्या है?',['सूर + उदय','सूर्य + उदय','सूर्यो + दय','सूर्य + ओदय'],1,'सूर्य + उदय = सूर्योदय (गुण संधि: अ + उ = ओ)।'),
  mk('h5','Hindi','समास','Medium','"राजपुत्र" में कौन-सा समास है?',['द्वंद्व','बहुव्रीहि','तत्पुरुष','द्विगु'],2,'"राजा का पुत्र" — षष्ठी विभक्ति का लोप होने से यह तत्पुरुष समास है।'),
  mk('h6','Hindi','मुहावरे','Easy','"आँखों का तारा" मुहावरे का अर्थ क्या है?',['अंधा होना','बहुत प्यारा','रोता हुआ','चालाक'],1,'"आँखों का तारा" का अर्थ है — बहुत प्यारा / अत्यंत दुलारा।'),
  mk('h7','Hindi','मुहावरे','Medium','"नौ दो ग्यारह होना" मुहावरे का अर्थ क्या है?',['जोड़ना','भाग जाना','बहुत धनी होना','खुश होना'],1,'"नौ दो ग्यारह होना" का अर्थ है — चुपके से भाग जाना।')
];

/* ---------- EXAMS ---------- */
const EXAMS = [
  { cat:'ssc', code:'CGL', name:'SSC CGL', desc:'Combined Graduate Level — Group B & C posts.' },
  { cat:'ssc', code:'CHSL', name:'SSC CHSL', desc:'10+2 Level — LDC, DEO and Postal Assistant.' },
  { cat:'ssc', code:'MTS', name:'SSC MTS', desc:'Multi-Tasking Staff — Group C non-gazetted.' },
  { cat:'ssc', code:'GD', name:'SSC GD Constable', desc:'General Duty Constable in CAPFs & Assam Rifles.' },
  { cat:'ssc', code:'CPO', name:'SSC CPO', desc:'Central Police Organisation — Sub-Inspector.' },
  { cat:'railway', code:'NTPC', name:'RRB NTPC', desc:'Non-Technical Popular Categories — Station Master, Clerk.' },
  { cat:'railway', code:'GRPD', name:'RRB Group D', desc:'Level 1 posts — Track Maintainer, Helper.' },
  { cat:'railway', code:'ALP', name:'RRB ALP', desc:'Assistant Loco Pilot — technical & aptitude.' },
  { cat:'railway', code:'TECH', name:'RRB Technician', desc:'Technician Grade III in various trades.' },
  { cat:'bihar', code:'BPSC', name:'BPSC CCE', desc:'Bihar Public Service Commission — Combined Competitive.' },
  { cat:'bihar', code:'BP', name:'Bihar Police', desc:'Constable & Sub-Inspector recruitment.' },
  { cat:'bihar', code:'BSSC', name:'Bihar SSC', desc:'BSSC Inter-Level & Graduate-Level posts.' },
  { cat:'bihar', code:'DRG', name:'Bihar Daroga', desc:'Sub-Inspector of Police — Bihar.' },
  { cat:'other', code:'BANK', name:'Banking', desc:'IBPS PO/Clerk, SBI, RRB and other bank exams.' },
  { cat:'other', code:'UPSC', name:'UPSC Civil Services', desc:'IAS, IPS, IFS and other central services.' },
  { cat:'other', code:'STATE', name:'State Govt Exams', desc:'State-level PSC, SSC and departmental exams.' },
  { cat:'other', code:'DEF', name:'Defence Exams', desc:'NDA, CDS, AFCAT and other defence entries.' },
];

/* ---------- MOCK TESTS (each lists the question ids it uses) ---------- */
const TESTS = [
  { id:1, title:'SSC MTS Full-Length Mock Test 1', exam:'SSC MTS', dur:45, lang:'English', diff:'Medium', access:'Free', type:'Full Mock',
    ids:['m2','m4','m7','m10','m16','r1','r2','r3','r5','r7','g1','g2','g4','g5','g7','g8','s1','s3','s5','s6','e1','e2','e3','e4','e6'] },
  { id:2, title:'RRB NTPC Practice Set — Mathematics', exam:'RRB NTPC', dur:20, lang:'English', diff:'Easy', access:'Free', type:'Subject',
    ids:['m1','m2','m3','m4','m5','m7','m9','m10','m11','m12','m13','m15','m16','m17','m18'] },
];
/* admin-added questions and tests (validated; bad entries are ignored) */
(function mergeContent() {
  const have = new Set(QUESTIONS.map(q => q.id));
  CONTENT.questions.forEach(q => {
    if (!q || !q.id || have.has(q.id) || !q.q || !Array.isArray(q.opts) || q.opts.length !== 4 || !(q.ans >= 0 && q.ans <= 3)) return;
    QUESTIONS.push(Object.assign({ subject: 'General Awareness', chapter: 'History', diff: 'Medium', exp: '' }, q, { custom: true })); have.add(q.id);
  });
  CONTENT.tests.forEach(t => {
    if (!t || !t.id || !t.title || !Array.isArray(t.ids)) return;
    const ids = t.ids.filter(i => have.has(i));
    if (!ids.length || TESTS.some(x => String(x.id) === String(t.id))) return;
    TESTS.push({ id: t.id, title: t.title, exam: t.exam || 'SSC MTS', dur: +t.dur || Math.max(5, ids.length), lang: t.lang || 'English', diff: t.diff || 'Medium', access: t.access || 'Free', type: t.type || 'Full Mock', ids, custom: true });
  });
})();
/* question count and marks always follow the id list (1 mark each, no negative marking) */
TESTS.forEach(t => { t.q = t.ids.length; t.marks = t.ids.length; });
/* number of tests per exam is derived, so it can never go out of sync */
EXAMS.forEach(e => { e.tests = TESTS.filter(t => t.exam === e.name).length; });

const PAPERS = [
  { year:2023, exam:'SSC CGL', paper:'Tier 1 — Shift 1', q:100, dur:60 },
  { year:2023, exam:'RRB NTPC', paper:'CBT 1 — Shift 2', q:100, dur:90 },
  { year:2022, exam:'SSC CHSL', paper:'Tier 1 — Shift 1', q:100, dur:60 },
  { year:2022, exam:'BPSC CCE', paper:'Prelims — GS', q:150, dur:120 },
];

const PRACTICE_TOPICS = [
  { subject:'Mathematics', chapters:['Number System','Percentage','Time & Work','Profit & Loss','Geometry','Algebra','Average','Speed & Distance'], icon:'➗' },
  { subject:'Reasoning', chapters:['Series','Coding-Decoding','Blood Relations','Syllogism','Non-Verbal'], icon:'🧩' },
  { subject:'General Awareness', chapters:['History','Geography','Polity','Economics','Current Affairs'], icon:'🌍' },
  { subject:'General Science', chapters:['Physics','Chemistry','Biology'], icon:'🔬' },
  { subject:'English', chapters:['Grammar','Vocabulary','Reading Comprehension','Cloze Test'], icon:'📖' },
  { subject:'Hindi', chapters:['व्याकरण','संधि','समास','मुहावरे'], icon:'🕉️' },
];

/* ---------- HELPERS ---------- */
function diffClass(d) { return d === 'Easy' ? 'badge-easy' : d === 'Hard' ? 'badge-hard' : 'badge-medium'; }
function accessClass(a) { return a === 'Free' ? 'badge-free' : 'badge-premium'; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return h ? h + ':' + mm + ':' + ss : mm + ':' + ss;
}
function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch (e) { return '—'; }
}
function getAttempts() { const a = store.get('exampro-attempts', []); return Array.isArray(a) ? a : []; }
function setAttempts(list) { return store.set('exampro-attempts', list); }
function getWrong() { const a = store.get('exampro-wrong', []); return Array.isArray(a) ? a : []; }
function setWrong(list) { return store.set('exampro-wrong', list); }
function getUser() { return store.get('exampro-user', null); }

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------- HEADER + FOOTER (same on every page) ---------- */
(function buildChrome() {
  const page = document.body.getAttribute('data-page') || '';
  const searchPh = document.body.getAttribute('data-search') || 'Search exams…';
  const nav = [
    ['index.html', 'Home', 'home'], ['exams.html', 'All Exams', 'exams'], ['tests.html', 'Mock Tests', 'tests'],
    ['practice.html', 'Practice', 'practice'], ['materials.html', 'Study Material', 'materials'],
    ['current-affairs.html', 'Current Affairs', 'ca']
  ];
  const more = [
    ['dashboard.html', 'Dashboard', 'dashboard'], ['results.html', 'My Results', 'results'],
    ['leaderboard.html', 'Leaderboard', 'leaderboard'], ['papers.html', 'Previous Papers', 'papers'],
    ['pricing.html', 'Pricing', 'pricing'], ['about.html', 'About', 'about'], ['contact.html', 'Contact', 'contact']
  ];
  const moreActive = more.some(n => n[2] === page);
  const user = getUser();
  const initial = user && user.name ? escapeHtml((user.name.trim().charAt(0) || 'U').toUpperCase()) : '';
  /* ONE login button: with the ExamPro server running it opens the student portal login, otherwise the local account page */
  const loginHref = /(?:^|;\s*)ep_srv=1/.test(document.cookie) ? '/student/login' : 'login.html';
  const authDesktop = user
    ? `<a href="dashboard.html" class="btn btn-ghost user-chip auth-desktop" title="My dashboard"><span class="avatar">${initial}</span><span class="uname">${escapeHtml(user.name)}</span></a>
       <button type="button" class="btn btn-outline auth-desktop js-logout">Logout</button>`
    : `<a href="${loginHref}" class="btn btn-ghost auth-desktop">Login</a>
       <a href="register.html" class="btn btn-primary auth-desktop">Get Started</a>`;
  const authMobile = (user
    ? `<a href="profile.html" class="btn btn-outline">My Profile</a><button type="button" class="btn btn-primary js-logout">Logout</button>`
    : `<a href="${loginHref}" class="btn btn-outline">Login</a><a href="register.html" class="btn btn-primary">Get Started</a>`);

  const headerHtml = `
  <header>
    <div class="container nav">
      <a href="index.html" class="logo"><span class="logo-mark">EP</span><span>ExamPro</span></a>
      <nav class="nav-links" id="navLinks" aria-label="Main">
        ${nav.map(n => `<a href="${n[0]}"${n[2] === page ? ' class="active" aria-current="page"' : ''}>${n[1]}</a>`).join('')}
        <div class="nav-more" id="navMore">
          <button type="button" class="more-btn${moreActive ? ' active' : ''}" id="moreBtn" aria-haspopup="true" aria-expanded="false">More ▾</button>
          <div class="more-menu">${more.map(n => `<a href="${n[0]}"${n[2] === page ? ' class="active" aria-current="page"' : ''}>${n[1]}</a>`).join('')}<a href="#" id="installMenuItem" class="hide">📲 Install app</a></div>
        </div>
        <div class="mobile-menu-search"><input type="search" class="js-navsearch" placeholder="${escapeHtml(searchPh)}" aria-label="Search" /></div>
        <div class="mobile-menu-extra">${authMobile}</div>
      </nav>
      <div class="nav-right">
        <div class="search-mini">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="navSearch" class="js-navsearch" placeholder="${escapeHtml(searchPh)}" aria-label="Search" />
        </div>
        <button type="button" class="icon-btn" id="themeToggle" aria-label="Toggle dark mode" title="Toggle theme">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        </button>
        ${authDesktop}
        <button type="button" class="icon-btn menu-toggle" id="menuToggle" aria-label="Open menu" aria-expanded="false" aria-controls="navLinks">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </div>
    </div>
  </header>`;

  const footerHtml = `
  <footer>
    <div class="container">
      <div class="foot-grid">
        <div class="foot-brand">
          <div class="logo" style="color:#fff"><span class="logo-mark">EP</span><span>ExamPro</span></div>
          <p>A modern practice platform for Indian competitive exams. Built for aspirants, by aspirants.</p>
        </div>
        <div><h4>Platform</h4><ul>
          <li><a href="exams.html">All Exams</a></li><li><a href="tests.html">Mock Tests</a></li>
          <li><a href="tests.html#custom">Custom Tests</a></li><li><a href="practice.html">Practice</a></li>
          <li><a href="materials.html">Study Material</a></li><li><a href="current-affairs.html">Current Affairs</a></li>
          <li><a href="papers.html">Previous Papers</a></li><li><a href="leaderboard.html">Leaderboard</a></li></ul></div>
        <div><h4>Company</h4><ul>
          <li><a href="about.html">About</a></li><li><a href="contact.html">Contact</a></li>
          <li><a href="contact.html#faq">Support</a></li><li><a href="pricing.html">Pricing</a></li></ul></div>
        <div><h4>Legal</h4><ul>
          <li><a href="privacy.html">Privacy Policy</a></li><li><a href="terms.html">Terms of Service</a></li>
          <li><a href="refund.html">Refund Policy</a></li></ul></div>
      </div>
      <div class="foot-bottom"><span>© <span id="year">${new Date().getFullYear()}</span> ExamPro. All rights reserved.</span><span>Made in India 🇮🇳</span><span class="foot-login"><button type="button" class="foot-admin js-admin-login">Admin Login</button></span></div>
    </div>
  </footer>`;

  /* app-style bottom tab bar (phones; hidden on desktop via CSS) */
  const tabIcon = p => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const tabs = [['index.html', 'Home', 'home', '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'], ['exams.html', 'Exams', 'exams', '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'],
    ['tests.html', 'Tests', 'tests', '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'], ['practice.html', 'Practice', 'practice', '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>']];
  const bottomHtml = ['test-attempt', 'admin', '404'].includes(page) ? '' : `<nav class="bottom-nav" aria-label="App navigation">${tabs.map(t => `<a href="${t[0]}" class="${t[2] === page ? 'on' : ''}"${t[2] === page ? ' aria-current="page"' : ''}>${tabIcon(t[3])}<span>${t[1]}</span></a>`).join('')}<button type="button" id="tabMenu" aria-label="More menu">${tabIcon('<path d="M4 6h16M4 12h16M4 18h16"/>')}<span>More</span></button></nav>`;
  const h = document.getElementById('site-header');
  if (h) h.outerHTML = headerHtml;
  const f = document.getElementById('site-footer');
  if (f) f.outerHTML = footerHtml;
  if (bottomHtml) document.body.insertAdjacentHTML('beforeend', bottomHtml);
  const tm = document.getElementById('tabMenu'); if (tm) tm.addEventListener('click', e => { e.stopPropagation(); const mt = document.getElementById('menuToggle'); if (mt) mt.click(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* theme toggle */
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('exampro-theme', next); } catch (e) {}
  });

  /* mobile menu */
  const menuBtn = document.getElementById('menuToggle');
  const links = document.getElementById('navLinks');
  if (menuBtn && links) {
    const setOpen = open => { links.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
    menuBtn.addEventListener('click', e => { e.stopPropagation(); setOpen(!links.classList.contains('open')); });
    document.addEventListener('click', e => { if (!links.contains(e.target) && e.target !== menuBtn) setOpen(false); });
    window.addEventListener('resize', () => { if (window.innerWidth > 1100) setOpen(false); });
  }

  /* "More" dropdown */
  const moreBox = document.getElementById('navMore'), moreBtn = document.getElementById('moreBtn');
  if (moreBox && moreBtn) {
    moreBtn.addEventListener('click', e => { e.stopPropagation(); const o = !moreBox.classList.contains('open'); moreBox.classList.toggle('open', o); moreBtn.setAttribute('aria-expanded', String(o)); });
    document.addEventListener('click', e => { if (!moreBox.contains(e.target)) { moreBox.classList.remove('open'); moreBtn.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') moreBox.classList.remove('open'); });
  }

  /* logout (desktop + mobile buttons) */
  document.querySelectorAll('.js-logout').forEach(b => b.addEventListener('click', () => {
    store.del('exampro-user');
    showToast('Signed out');
    setTimeout(() => { location.href = 'index.html'; }, 500);
  }));

  /* header search (desktop + mobile menu): pages can define window.onNavSearch(value) for live
     filtering; otherwise Enter jumps to the exams page with the query */
  const searchBoxes = [...document.querySelectorAll('.js-navsearch')];
  searchBoxes.forEach(box => {
    box.addEventListener('input', () => {
      searchBoxes.forEach(o => { if (o !== box) o.value = box.value; });
      if (typeof window.onNavSearch === 'function') window.onNavSearch(box.value);
    });
    box.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      if (typeof window.onNavSearch === 'function') { e.preventDefault(); window.onNavSearch(box.value); return; }
      const q = encodeURIComponent(box.value.trim());
      location.href = 'exams.html' + (q ? '?q=' + q : '');
    });
  });
})();


/* =====================================================================
   ADDITIONS (v2) — helpers, bookmarks, stats, and content data
   ===================================================================== */

/* If you set this, the Contact form opens the visitor's mail app addressed here.
   Leave empty and messages are saved on the visitor's device only. */
const CONTACT_EMAIL = (CONTENT.settings && CONTENT.settings.contactEmail) || '';

/* ---------- bookmarks / notes flags ---------- */
function getBookmarks() { const a = store.get('exampro-bookmarks', []); return Array.isArray(a) ? a : []; }
function toggleBookmark(id) {
  const s = new Set(getBookmarks()); let on;
  if (s.has(id)) { s.delete(id); on = false; } else { s.add(id); on = true; }
  store.set('exampro-bookmarks', [...s]); return on;
}
function qById() { const m = {}; QUESTIONS.forEach(q => { m[q.id] = q; }); return m; }

/* ---------- date + stats helpers ---------- */
function dayKey(d) {
  const x = new Date(d);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}
function calcStreak(attempts) {
  const days = new Set(attempts.map(a => dayKey(a.date)));
  let cur = 0; const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) { cur++; d.setDate(d.getDate() - 1); }
  let best = 0, run = 0, prev = null;
  [...days].sort().forEach(k => {
    const t = new Date(k + 'T00:00:00');
    if (prev && Math.round((t - prev) / 864e5) === 1) run++; else run = 1;
    if (run > best) best = run; prev = t;
  });
  return { current: cur, best };
}
function questionsToday(attempts) {
  const k = dayKey(new Date());
  return attempts.filter(a => dayKey(a.date) === k).reduce((s, a) => s + a.correct + a.wrong, 0);
}
function overallStats(attempts) {
  let corr = 0, att = 0, secs = 0, best = 0, pctSum = 0;
  attempts.forEach(a => {
    corr += a.correct; att += a.correct + a.wrong; secs += a.timeSec || 0;
    const p = a.total ? Math.round(a.correct / a.total * 100) : 0; pctSum += p; if (p > best) best = p;
  });
  return { attempts: attempts.length, correct: corr, attempted: att, accuracy: att ? Math.round(corr / att * 100) : 0,
           avgPct: attempts.length ? Math.round(pctSum / attempts.length) : 0, best, secs };
}
/* accuracy per subject and per subject/chapter, from every saved attempt */
function topicStats(attempts) {
  const m = qById(), subj = {}, chap = {};
  attempts.forEach(a => (a.qids || []).forEach(id => {
    const q = m[id]; if (!q) return;
    const sel = a.answers ? a.answers[id] : undefined; if (sel === undefined) return;
    const ok = sel === q.ans ? 1 : 0;
    const s = subj[q.subject] || (subj[q.subject] = { att: 0, ok: 0 }); s.att++; s.ok += ok;
    const key = q.subject + '||' + q.chapter;
    const c = chap[key] || (chap[key] = { subject: q.subject, chapter: q.chapter, att: 0, ok: 0 }); c.att++; c.ok += ok;
  }));
  return { subj, chap: Object.values(chap) };
}
function setUser(patch) {
  const u = Object.assign({}, getUser() || {}, patch);
  store.set('exampro-user', u);
  if (u.email) { const all = store.get('exampro-users', {}) || {}; all[u.email] = Object.assign({}, all[u.email] || {}, { name: u.name, exam: u.exam || '', goal: u.goal || 20 }); store.set('exampro-users', all); }
  return u;
}
function needsSignIn(container, what) {
  container.innerHTML = `<div class="empty panel" style="padding:56px 24px">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>
    <h3>Sign in to see ${escapeHtml(what)}</h3><p>It only takes a moment — no password is stored in this development build.</p>
    <div class="btn-row"><a class="btn btn-primary btn-lg" href="login.html?next=${encodeURIComponent(location.pathname.split('/').pop() || 'index.html')}">Sign In</a><a class="btn btn-outline btn-lg" href="register.html">Create account</a></div></div>`;
}
function downloadFile(name, text, type) {
  const blob = new Blob([text], { type: type || 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}

/* ---------- EXAM DETAILS (used by exam-detail.html) ----------
   Patterns are typical/recent; exams change them, so the page always tells users to
   verify the official notification. Only add `pattern` when you are sure of it. */
const EXAM_INFO = {
  'SSC CGL': { full:'Staff Selection Commission — Combined Graduate Level', body:'Staff Selection Commission (SSC)', site:'https://ssc.gov.in', edu:'Bachelor\'s degree (some posts need specific qualifications)',
    stages:['Tier 1 — computer-based, qualifying + merit','Tier 2 — computer-based, multiple papers','Skill test / typing test (post dependent)','Document verification'],
    subjects:['Mathematics','Reasoning','General Awareness','English'],
    pattern:{ title:'Tier 1 (typical)', duration:60, negative:'0.50 per wrong answer', rows:[['General Intelligence & Reasoning',25,50],['General Awareness',25,50],['Quantitative Aptitude',25,50],['English Comprehension',25,50]] } },
  'SSC CHSL': { full:'Staff Selection Commission — Combined Higher Secondary Level', body:'Staff Selection Commission (SSC)', site:'https://ssc.gov.in', edu:'12th pass (Class XII)',
    stages:['Tier 1 — computer-based','Tier 2 — descriptive paper (letter/essay)','Skill / typing test','Document verification'],
    subjects:['Mathematics','Reasoning','General Awareness','English'],
    pattern:{ title:'Tier 1 (typical)', duration:60, negative:'0.50 per wrong answer', rows:[['English Language',25,50],['General Intelligence',25,50],['Quantitative Aptitude',25,50],['General Awareness',25,50]] } },
  'SSC MTS': { full:'Staff Selection Commission — Multi-Tasking Staff', body:'Staff Selection Commission (SSC)', site:'https://ssc.gov.in', edu:'10th pass (Matriculation)',
    stages:['Computer-based examination (sessions)','Physical tests for certain posts (e.g. Havaldar)','Document verification'],
    subjects:['Mathematics','Reasoning','General Awareness','English'] },
  'SSC GD Constable': { full:'SSC General Duty Constable (CAPFs, NIA, SSF, Assam Rifles)', body:'Staff Selection Commission (SSC)', site:'https://ssc.gov.in', edu:'10th pass (Matriculation)',
    stages:['Computer-based examination','Physical Efficiency Test (PET) & Physical Standard Test (PST)','Medical examination','Document verification'],
    subjects:['Reasoning','General Awareness','Mathematics','English / Hindi'] },
  'SSC CPO': { full:'SSC Central Police Organisation — Sub-Inspector', body:'Staff Selection Commission (SSC)', site:'https://ssc.gov.in', edu:'Bachelor\'s degree',
    stages:['Paper 1 — computer-based','PET / PST','Paper 2 — computer-based','Medical examination'],
    subjects:['Reasoning','General Awareness','Mathematics','English'] },
  'RRB NTPC': { full:'Railway Recruitment Boards — Non-Technical Popular Categories', body:'Railway Recruitment Boards (RRB)', site:'', edu:'12th pass (undergraduate posts) or Graduation (graduate posts)',
    stages:['CBT 1 — screening','CBT 2 — main','Typing / aptitude test (post dependent)','Document verification & medical'],
    subjects:['Mathematics','Reasoning','General Awareness'],
    pattern:{ title:'CBT 1 (typical)', duration:90, negative:'1/3 mark per wrong answer', rows:[['General Awareness',40,40],['Mathematics',30,30],['General Intelligence & Reasoning',30,30]] } },
  'RRB Group D': { full:'Railway Recruitment Boards — Level 1 posts', body:'Railway Recruitment Boards (RRB)', site:'', edu:'10th pass / ITI / NAC (as notified)',
    stages:['Computer Based Test','Physical Efficiency Test','Document verification & medical'],
    subjects:['Mathematics','Reasoning','General Science','General Awareness'],
    pattern:{ title:'CBT (typical)', duration:90, negative:'1/3 mark per wrong answer', rows:[['Mathematics',25,25],['General Intelligence & Reasoning',30,30],['General Science',25,25],['General Awareness & Current Affairs',20,20]] } },
  'RRB ALP': { full:'Railway Recruitment Boards — Assistant Loco Pilot', body:'Railway Recruitment Boards (RRB)', site:'', edu:'10th + ITI / Diploma (as notified)',
    stages:['CBT 1','CBT 2 (Part A & B)','Computer Based Aptitude Test (CBAT)','Document verification & medical'], subjects:['Mathematics','Reasoning','General Science','General Awareness'] },
  'RRB Technician': { full:'Railway Recruitment Boards — Technician', body:'Railway Recruitment Boards (RRB)', site:'', edu:'10th + ITI (Grade III) / Diploma or Degree (Grade I Signal)',
    stages:['Computer Based Test','Document verification & medical'], subjects:['Mathematics','Reasoning','General Science','General Awareness'] },
  'BPSC CCE': { full:'Bihar Public Service Commission — Combined Competitive Examination', body:'Bihar Public Service Commission (BPSC)', site:'', edu:'Bachelor\'s degree',
    stages:['Preliminary examination (screening)','Main examination (written)','Interview'],
    subjects:['General Awareness','History','Geography','Polity','Economics','General Science'],
    pattern:{ title:'Prelims (typical)', duration:120, negative:'1/3 mark per wrong answer', rows:[['General Studies (incl. Bihar-specific)',150,150]] } },
  'Bihar Police': { full:'Bihar Police — Constable & Sub-Inspector', body:'Central Selection Board of Constable (CSBC) / BPSSC', site:'', edu:'12th pass (Constable) / Graduation (Sub-Inspector)',
    stages:['Written examination','Physical Efficiency Test','Medical & document verification'], subjects:['General Awareness','Mathematics','Reasoning','Hindi'] },
  'Bihar SSC': { full:'Bihar Staff Selection Commission', body:'Bihar Staff Selection Commission (BSSC)', site:'', edu:'12th pass (Inter-level) / Graduation (Graduate-level)',
    stages:['Written examination (objective)','Document verification'], subjects:['General Awareness','Mathematics','Reasoning','Hindi','English'] },
  'Bihar Daroga': { full:'Bihar Police — Sub-Inspector (Daroga)', body:'Bihar Police Subordinate Services Commission (BPSSC)', site:'', edu:'Bachelor\'s degree',
    stages:['Written examination','Physical Efficiency Test','Medical & document verification'], subjects:['General Awareness','Mathematics','Reasoning','Hindi','English'] },
  'Banking': { full:'Banking exams — IBPS PO/Clerk, SBI, RRB and others', body:'IBPS / SBI', site:'https://www.ibps.in', edu:'Bachelor\'s degree',
    stages:['Preliminary examination','Main examination','Interview (PO) / Language test (Clerk)'], subjects:['Mathematics','Reasoning','English','General Awareness'] },
  'UPSC Civil Services': { full:'UPSC Civil Services Examination (IAS, IPS, IFS …)', body:'Union Public Service Commission (UPSC)', site:'https://upsc.gov.in', edu:'Bachelor\'s degree',
    stages:['Preliminary examination (2 objective papers)','Main examination (9 descriptive papers)','Personality Test (interview)'],
    subjects:['History','Geography','Polity','Economics','General Science','Current Affairs'],
    pattern:{ title:'Prelims (typical)', duration:120, negative:'1/3 of the marks per wrong answer', rows:[['Paper I — General Studies',100,200],['Paper II — CSAT (qualifying, 33%)',80,200]] } },
  'State Govt Exams': { full:'State-level PSC, SSC and departmental exams', body:'Respective State Commissions', site:'', edu:'Varies by post',
    stages:['Written examination','Skill / physical test (if applicable)','Interview / document verification'], subjects:['General Awareness','Mathematics','Reasoning','English','Hindi'] },
  'Defence Exams': { full:'Defence entries — NDA, CDS, AFCAT and others', body:'UPSC / Indian Air Force / Services', site:'https://upsc.gov.in', edu:'12th pass (NDA) / Graduation (CDS, AFCAT) — as notified',
    stages:['Written examination','SSB interview / selection board','Medical examination'], subjects:['Mathematics','English','General Awareness','General Science','Reasoning'] }
};

/* ---------- STUDY NOTES (used by materials.html) ----------
   block types: ['h', text] ['p', text] ['ul', [..]] ['f', 'formula'] ['table', {head:[..], rows:[[..]]}] */
const NOTES = [
  { id:'n-percentage', subject:'Mathematics', chapter:'Percentage', title:'Percentage — fractions & shortcuts', mins:5, body:[
    ['p','Percentage means "per hundred". Memorise the common fraction ↔ percent pairs — they save the most time in the exam.'],
    ['table',{head:['Fraction','Percent','Fraction','Percent'],rows:[['1/2','50%','1/7','14.28%'],['1/3','33.33%','1/8','12.5%'],['1/4','25%','1/9','11.11%'],['1/5','20%','1/10','10%'],['1/6','16.67%','1/11','9.09%']]}],
    ['h','Key formulas'],
    ['f','x% of y = (x ÷ 100) × y'],
    ['f','Percentage change = (change ÷ original) × 100'],
    ['f','Successive change of a% and b%  =  a + b + (a × b)/100 %'],
    ['f','Value after r% increase = original × (100 + r)/100'],
    ['h','Tips'],
    ['ul',['A +20% change then −20% change does NOT return to the original (net −4%).','x% of y = y% of x — use whichever is easier.','To undo an r% increase, divide by (1 + r/100); do not subtract r%.']] ]},
  { id:'n-profit', subject:'Mathematics', chapter:'Profit & Loss', title:'Profit, Loss & Discount', mins:5, body:[
    ['f','Profit % = (SP − CP) ÷ CP × 100            Loss % = (CP − SP) ÷ CP × 100'],
    ['f','SP = CP × (100 + P%)/100            CP = SP × 100/(100 + P%)'],
    ['f','Discount = Marked Price − Selling Price;   Discount % = Discount ÷ MP × 100'],
    ['f','Successive discounts a% and b%  →  net discount = a + b − (a×b)/100 %'],
    ['h','Remember'],
    ['ul',['Profit and loss % are always on cost price unless stated otherwise.','Discount % is always on marked price.','If two articles are sold at the same price, one at x% gain and one at x% loss, there is always a loss of x²/100 %.']] ]},
  { id:'n-timework', subject:'Mathematics', chapter:'Time & Work', title:'Time & Work — the LCM method', mins:4, body:[
    ['p','Take the total work as the LCM of the days given. Each person\'s daily efficiency is then a whole number.'],
    ['f','A does a job in a days, B in b days  →  together: ab/(a + b) days'],
    ['f','Work = Efficiency × Time        Efficiency ∝ 1/Time'],
    ['f','M1 × D1 × H1 / W1 = M2 × D2 × H2 / W2'],
    ['h','Example'],
    ['p','A = 10 days, B = 15 days. Total work = LCM = 30 units. A = 3/day, B = 2/day → together 5/day → 30 ÷ 5 = 6 days.'],
    ['h','Pipes & cisterns'],
    ['ul',['Inlet pipe = positive efficiency, outlet pipe = negative efficiency.','Net rate = sum of efficiencies (with signs).']] ]},
  { id:'n-speed', subject:'Mathematics', chapter:'Speed & Distance', title:'Speed, Distance, Trains & Boats', mins:5, body:[
    ['f','Speed = Distance ÷ Time'],
    ['f','1 km/h = 5/18 m/s        1 m/s = 18/5 km/h'],
    ['f','Average speed for equal distances at x and y  =  2xy/(x + y)'],
    ['f','Relative speed: same direction = difference; opposite direction = sum'],
    ['h','Trains'],
    ['ul',['Train crossing a pole/person: distance = length of train.','Train crossing a platform/bridge: distance = length of train + length of platform.','Two trains crossing: distance = sum of lengths.']],
    ['h','Boats & streams'],
    ['f','Downstream = u + v        Upstream = u − v   (u = boat speed, v = stream speed)'],
    ['f','u = (down + up)/2        v = (down − up)/2'] ]},
  { id:'n-number', subject:'Mathematics', chapter:'Number System', title:'Number System — divisibility & basics', mins:5, body:[
    ['table',{head:['By','Rule'],rows:[['2','Last digit is even'],['3','Sum of digits divisible by 3'],['4','Last two digits divisible by 4'],['5','Last digit 0 or 5'],['6','Divisible by both 2 and 3'],['8','Last three digits divisible by 8'],['9','Sum of digits divisible by 9'],['11','Difference of sums of alternate digits is 0 or a multiple of 11']]}],
    ['f','HCF × LCM = Product of the two numbers'],
    ['p','Primes up to 50: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47.'],
    ['ul',['1 is neither prime nor composite; 2 is the only even prime.','Sum of first n natural numbers = n(n + 1)/2.','Sum of first n odd numbers = n².']] ]},
  { id:'n-geometry', subject:'Mathematics', chapter:'Geometry', title:'Geometry & Mensuration formulas', mins:6, body:[
    ['ul',['Angles of a triangle add up to 180°. Exterior angle = sum of the two opposite interior angles.','Sum of interior angles of an n-sided polygon = (n − 2) × 180°.','Pythagoras: a² + b² = c². Common triples: (3,4,5), (5,12,13), (8,15,17), (7,24,25).']],
    ['table',{head:['Shape','Area','Perimeter / other'],rows:[['Rectangle','l × b','2(l + b)'],['Square','a²','4a'],['Triangle','½ × b × h','sum of sides'],['Circle','πr²','2πr'],['Parallelogram','b × h','2(a + b)'],['Trapezium','½(a + b) × h','—']]}],
    ['table',{head:['Solid','Volume','Curved/Total surface'],rows:[['Cuboid','l × b × h','2(lb + bh + hl)'],['Cube','a³','6a²'],['Cylinder','πr²h','CSA 2πrh, TSA 2πr(r + h)'],['Cone','⅓πr²h','CSA πrl, TSA πr(r + l)'],['Sphere','4/3 πr³','4πr²']]}],
    ['p','Use π = 22/7 when the radius is a multiple of 7.'] ]},
  { id:'n-algebra', subject:'Mathematics', chapter:'Algebra', title:'Algebra — identities to memorise', mins:3, body:[
    ['f','(a + b)² = a² + 2ab + b²'], ['f','(a − b)² = a² − 2ab + b²'], ['f','a² − b² = (a + b)(a − b)'],
    ['f','(a + b)³ = a³ + b³ + 3ab(a + b)'], ['f','a³ + b³ = (a + b)(a² − ab + b²)'], ['f','a³ − b³ = (a − b)(a² + ab + b²)'],
    ['f','If a + b + c = 0  then  a³ + b³ + c³ = 3abc'],
    ['p','For a quadratic ax² + bx + c = 0, sum of roots = −b/a and product of roots = c/a.'] ]},
  { id:'n-average', subject:'Mathematics', chapter:'Average', title:'Average, Ratio & Interest', mins:5, body:[
    ['f','Average = Sum of observations ÷ Number of observations'],
    ['ul',['If one value is removed or added, work with totals: new total = average × count.','Average of consecutive numbers = the middle value.']],
    ['h','Ratio & mixture'],
    ['f','Alligation: (cheaper quantity) : (dearer quantity) = (d − m) : (m − c)'],
    ['h','Simple & compound interest'],
    ['f','SI = P × R × T / 100'],
    ['f','CI = P(1 + R/100)ᵀ − P'],
    ['f','CI − SI for 2 years = P(R/100)²'] ]},
  { id:'n-series', subject:'Reasoning', chapter:'Series', title:'Number & letter series patterns', mins:4, body:[
    ['ul',['Check differences first (constant? increasing by 2, 3, 4?), then ratios (×2, ×3), then squares/cubes (n², n³, n² ± 1).','Prime series: 2, 3, 5, 7, 11, 13, 17 …','Fibonacci type: each term is the sum of the previous two.','Alternating series: odd and even positions follow two different rules — split them.']],
    ['h','Alphabet positions'],
    ['p','A=1, B=2 … Z=26. The opposite letter of any letter adds up to 27 (A↔Z, B↔Y, C↔X). Write the positions of EJOTY: 5, 10, 15, 20, 25.'] ]},
  { id:'n-coding', subject:'Reasoning', chapter:'Coding-Decoding', title:'Coding-Decoding & Blood Relations', mins:5, body:[
    ['ul',['Letter coding: look for a constant shift (+1, +2, −1), a reverse order, or a mirror (position ↔ 27 − position).','Number-letter coding: assign A=1 … Z=26 and add or multiply as shown in the example.']],
    ['h','Blood relations'],
    ['ul',['Draw a family tree. Use ♂ / ♀ and → for "parent of".','Mother\'s brother = maternal uncle; father\'s sister = paternal aunt.','"Son of my mother\'s only son" = my brother\'s son = nephew.','"X is the only daughter of Y\'s wife" → X is Y\'s daughter.']] ]},
  { id:'n-direction', subject:'Reasoning', chapter:'Series', title:'Direction sense, Ranking & Syllogism', mins:5, body:[
    ['ul',['Direction: always draw a small diagram. Final distance = Pythagoras on the net East–West and North–South displacement.','After a right turn facing North you face East; after a left turn you face West.']],
    ['f','Total in a row = Rank from top + Rank from bottom − 1'],
    ['h','Syllogism quick rules'],
    ['ul',['All A are B + All B are C  →  All A are C.','Some A are B + All B are C  →  Some A are C.','All A are B does NOT mean All B are A.','Two "Some" statements, or two negative statements, give no definite conclusion.']] ]},
  { id:'n-polity', subject:'General Awareness', chapter:'Polity', title:'Indian Polity — Constitution essentials', mins:8, body:[
    ['ul',['Constitution adopted on 26 November 1949 and came into force on 26 January 1950.','Drafting Committee chairman: Dr B. R. Ambedkar. President of the Constituent Assembly: Dr Rajendra Prasad.','Parliament = President + Lok Sabha + Rajya Sabha. Lok Sabha: up to 550 members (543 elected at present). Rajya Sabha: up to 250 members.']],
    ['h','Fundamental Rights (Articles 12–35)'],
    ['table',{head:['Article','Subject'],rows:[['14','Equality before law'],['15','No discrimination on grounds of religion, race, caste, sex, birth place'],['16','Equality of opportunity in public employment'],['17','Abolition of untouchability'],['19','Six freedoms (speech, assembly, association, movement, residence, profession)'],['21','Protection of life and personal liberty'],['21A','Right to education (6–14 years) — added by the 86th Amendment'],['23–24','Right against exploitation'],['25–28','Freedom of religion'],['29–30','Cultural and educational rights'],['32','Right to constitutional remedies']]}],
    ['h','Other important articles'],
    ['ul',['Art. 52 — President of India; Art. 63 — Vice-President.','Art. 352 — National Emergency; Art. 356 — President\'s Rule; Art. 360 — Financial Emergency.','Art. 51A — Fundamental Duties (11 duties).','Directive Principles of State Policy — Articles 36 to 51.']],
    ['h','Amendments to remember'],
    ['ul',['42nd (1976) — "Mini-Constitution"; added Socialist, Secular, Integrity to the Preamble.','61st (1988) — voting age 21 → 18.','73rd & 74th (1992) — Panchayati Raj and Municipalities.','101st (2016) — GST.','106th (2023) — reservation for women in Lok Sabha and State Assemblies.']] ]},
  { id:'n-history', subject:'General Awareness', chapter:'History', title:'History — timeline & Bihar connection', mins:8, body:[
    ['table',{head:['Year','Event'],rows:[['321 BCE','Chandragupta Maurya founds the Maurya Empire (capital Pataliputra)'],['261 BCE','Ashoka and the Kalinga War'],['1206','Delhi Sultanate begins'],['1526','First Battle of Panipat — Mughal rule begins'],['1757 / 1764','Battle of Plassey / Battle of Buxar'],['1857','First War of Independence'],['1885','Indian National Congress founded'],['1905','Partition of Bengal'],['1917','Champaran Satyagraha (Bihar) — Gandhi\'s first in India'],['1919','Jallianwala Bagh massacre'],['1930','Salt March / Dandi'],['1942','Quit India Movement'],['1947','Independence — 15 August']]}],
    ['h','Bihar & Jharkhand'],
    ['ul',['Bihar was carved out of the Bengal Presidency in 1912.','Magadh was home to Pataliputra, Nalanda and Vikramshila universities.','Jharkhand was separated from Bihar on 15 November 2000.']] ]},
  { id:'n-geography', subject:'General Awareness', chapter:'Geography', title:'Geography — India & Bihar facts', mins:6, body:[
    ['ul',['India has 28 states and 8 Union Territories.','Largest state by area: Rajasthan. Smallest: Goa. Most populous: Uttar Pradesh.','Highest peak in India: Kanchenjunga. The Standard Meridian of India is 82°30\' E (passes near Mirzapur, Uttar Pradesh).','The Tropic of Cancer passes through 8 states: Gujarat, Rajasthan, Madhya Pradesh, Chhattisgarh, Jharkhand, West Bengal, Tripura and Mizoram.']],
    ['h','Bihar'],
    ['ul',['Capital: Patna. Number of districts: 38.','Major rivers: Ganga, Gandak, Kosi, Sone, Bagmati, Punpun.','The Kosi is called the "Sorrow of Bihar" because of its floods.']] ]},
  { id:'n-economy', subject:'General Awareness', chapter:'Economics', title:'Economy basics for exams', mins:4, body:[
    ['ul',['RBI was established on 1 April 1935; headquarters at Mumbai. It issues currency (except ₹1 notes/coins) and controls monetary policy.','NITI Aayog replaced the Planning Commission on 1 January 2015.','GST was launched on 1 July 2017 (101st Amendment).','GDP = total value of final goods and services produced within a country in a year.','Repo rate = rate at which RBI lends short-term to banks; reverse repo = rate at which RBI borrows from banks.']] ]},
  { id:'n-science', subject:'General Science', chapter:'Biology', title:'Science — vitamins, units & basics', mins:6, body:[
    ['table',{head:['Vitamin','Deficiency disease'],rows:[['A','Night blindness'],['B1','Beri-beri'],['B12','Pernicious anaemia'],['C','Scurvy'],['D','Rickets'],['K','Poor blood clotting']]}],
    ['table',{head:['Quantity','SI unit'],rows:[['Force','Newton (N)'],['Work / Energy','Joule (J)'],['Power','Watt (W)'],['Pressure','Pascal (Pa)'],['Frequency','Hertz (Hz)'],['Electric current','Ampere (A)']]}],
    ['ul',['Speed of light in vacuum ≈ 3 × 10⁸ m/s.','pH of pure water = 7 (acidic < 7 < basic).','Mitochondria — powerhouse of the cell. Nitrogen ≈ 78% of air, oxygen ≈ 21%.','Sodium = Na, Potassium = K, Iron = Fe, Gold = Au, Silver = Ag.']] ]},
  { id:'n-grammar', subject:'English', chapter:'Grammar', title:'Grammar — rules that score marks', mins:6, body:[
    ['h','Subject–verb agreement'],
    ['ul',['Each, every, either, neither, one of → singular verb ("Neither of them is ready").','The number of → singular; A number of → plural.','Two subjects joined by "and" → plural; joined by "or / nor" → verb agrees with the nearer subject.']],
    ['h','Articles'],
    ['ul',['Use "an" before a vowel SOUND (an hour, an umbrella) and "a" before a consonant sound (a university).','"The" is used for unique things (the sun) and specific nouns already mentioned.']],
    ['h','Common errors'],
    ['ul',['Use "fewer" with countable nouns and "less" with uncountable ones.','"Many a" takes a singular verb.','Prepositions: different FROM, prefer TO, angry WITH a person / AT a thing.']] ]},
  { id:'n-vocab', subject:'English', chapter:'Vocabulary', title:'Vocabulary — one-word substitutions', mins:4, body:[
    ['table',{head:['One word','Meaning'],rows:[['Polyglot','A person who speaks many languages'],['Philanthropist','One who loves mankind and does good for others'],['Misanthrope','One who hates mankind'],['Atheist','One who does not believe in God'],['Optimist','One who always hopes for the best'],['Pedestrian','One who travels on foot'],['Autobiography','Life story written by oneself'],['Orphan','A child who has lost both parents'],['Bibliophile','A lover of books'],['Omniscient','All-knowing'],['Anonymous','Of unknown name'],['Cynic','One who sneers at the goodness of others']]}] ]},
  { id:'n-hindi', subject:'Hindi', chapter:'संधि', title:'हिन्दी व्याकरण — संधि, समास, मुहावरे', mins:5, body:[
    ['h','संधि के तीन भेद'],
    ['ul',['स्वर संधि — विद्या + आलय = विद्यालय (दीर्घ), सूर्य + उदय = सूर्योदय (गुण)।','व्यंजन संधि — जगत् + ईश = जगदीश।','विसर्ग संधि — निः + चल = निश्चल।']],
    ['h','समास के प्रमुख भेद'],
    ['ul',['तत्पुरुष — राजपुत्र (राजा का पुत्र)।','द्विगु — त्रिलोक (तीन लोकों का समाहार)।','द्वंद्व — माता-पिता (माता और पिता)।','बहुव्रीहि — दशानन (दस हैं आनन जिसके अर्थात् रावण)।']],
    ['h','कुछ मुहावरे'],
    ['ul',['आँखों का तारा — बहुत प्यारा।','नौ दो ग्यारह होना — भाग जाना।','अंगूर खट्टे होना — चीज़ न मिलने पर उसे बुरा बताना।','ईंट से ईंट बजाना — पूरी तरह नष्ट कर देना।']] ]}
];

/* ---------- IMPORTANT DAYS (used by current-affairs.html) — fixed calendar dates ---------- */
const IMPORTANT_DAYS = [
  [1,9,'Pravasi Bharatiya Diwas'],[1,12,'National Youth Day (Swami Vivekananda Jayanti)'],[1,15,'Indian Army Day'],[1,25,'National Voters\' Day'],
  [1,26,'Republic Day'],[1,30,'Martyrs\' Day'],[2,28,'National Science Day'],[3,8,'International Women\'s Day'],[3,22,'World Water Day / Bihar Diwas'],
  [4,7,'World Health Day'],[4,22,'Earth Day'],[5,1,'International Labour Day'],[5,11,'National Technology Day'],[6,5,'World Environment Day'],
  [6,21,'International Yoga Day'],[7,1,'National Doctors\' Day'],[8,9,'Quit India Day'],[8,15,'Independence Day'],[8,29,'National Sports Day'],
  [9,5,'Teachers\' Day'],[9,14,'Hindi Diwas'],[9,15,'Engineers\' Day'],[10,2,'Gandhi Jayanti'],[10,8,'Indian Air Force Day'],[10,16,'World Food Day'],
  [10,24,'United Nations Day'],[10,31,'National Unity Day (Rashtriya Ekta Diwas)'],[11,11,'National Education Day'],[11,14,'Children\'s Day'],
  [11,26,'Constitution Day (Samvidhan Diwas)'],[12,1,'World AIDS Day'],[12,4,'Indian Navy Day'],[12,10,'Human Rights Day'],[12,16,'Vijay Diwas'],[12,23,'Kisan Diwas']
];

/* ---------- PLANS (used by pricing.html) — DEMO pricing, no payment gateway ---------- */
const PLANS = [
  { id:'free', name:'Free', monthly:0, yearly:0, blurb:'Everything you need to start practising.',
    feats:[['Free full-length & subject mock tests',1],['Chapter-wise practice',1],['Study notes & formulas',1],['Performance dashboard',1],['Custom test builder (up to 25 questions)',1],['Detailed solutions for every question',1],['Premium test series',0],['Priority support',0]] },
  { id:'pro', name:'Pro', monthly:199, yearly:1499, blurb:'For serious aspirants preparing every day.', featured:true,
    feats:[['Everything in Free',1],['Premium test series',1],['Custom tests up to 100 questions',1],['Unlimited retakes with analysis',1],['Weak-topic recommendations',1],['Downloadable result reports',1],['Priority support',1],['Mentor sessions',0]] },
  { id:'elite', name:'Elite', monthly:499, yearly:3999, blurb:'Maximum support until you are selected.',
    feats:[['Everything in Pro',1],['All-India test series (when live)',1],['Mentor sessions (when available)',1],['Doubt resolution',1],['Early access to new features',1],['Priority support',1]] }
];


/* =====================================================================
   ADDITIONS (v3) — metrics, announcement, PWA, carousel, team,
   test types and chapter mastery
   ===================================================================== */

/* ---------- METRICS (this browser only — see admin.html) ---------- */
function metricsGet() { const m = store.get('exampro-metrics', null); return m && m.v ? m : { v: { total: 0, pages: {}, days: {} }, ev: { counts: {}, log: [] }, sessions: 0, since: new Date().toISOString() }; }
function track(name, data) {
  try {
    const m = metricsGet();
    m.ev.counts[name] = (m.ev.counts[name] || 0) + 1;
    m.ev.log.unshift({ t: Date.now(), n: name, d: data || '' }); m.ev.log = m.ev.log.slice(0, 60);
    store.set('exampro-metrics', m);
  } catch (e) {}
}
(function trackView() {
  const page = (document.body && document.body.getAttribute('data-page')) || 'other';
  if (page === 'admin' || page === '404') return;
  try {
    const m = metricsGet(), day = dayKey(new Date());
    m.v.total++; m.v.pages[page] = (m.v.pages[page] || 0) + 1; m.v.days[day] = (m.v.days[day] || 0) + 1;
    const keys = Object.keys(m.v.days).sort(); while (keys.length > 60) delete m.v.days[keys.shift()];
    let newSession = false;
    try { if (!sessionStorage.getItem('exampro-sess')) { sessionStorage.setItem('exampro-sess', '1'); newSession = true; } } catch (e) {}
    if (newSession) m.sessions++;
    store.set('exampro-metrics', m);
  } catch (e) {}
})();

/* optional Google Analytics (set the ID in admin → Settings) for numbers across ALL visitors */
(function loadAnalytics() {
  const id = CONTENT.settings && CONTENT.settings.gaId;
  if (!id || !/^G-[A-Z0-9]+$/i.test(id) || (document.body && document.body.getAttribute('data-page') === 'admin')) return;
  const sc = document.createElement('script'); sc.async = true; sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id); document.head.appendChild(sc);
  window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date()); window.gtag('config', id);
})();

/* ---------- ANNOUNCEMENT BAR + DRAFT RIBBON ---------- */
(function bars() {
  const a = CONTENT.announcement;
  const page = (document.body && document.body.getAttribute('data-page')) || '';
  const wrap = document.createElement('div'); wrap.className = 'top-bars';
  if (CONTENT.__draft && page !== 'admin') {
    wrap.insertAdjacentHTML('beforeend', '<div class="draft-ribbon">Draft preview — only you see these changes. <a href="admin.html#publish">Publish from Admin</a></div>');
  }
  let dismissed = false; try { dismissed = localStorage.getItem('exampro-ann-' + a.id) === '1'; } catch (e) {}
  if (a.on && a.text && !dismissed) {
    const el = document.createElement('div'); el.className = 'announce'; el.setAttribute('role', 'status');
    const txt = a.link ? `<a href="${escapeHtml(a.link)}">${escapeHtml(a.text)} →</a>` : `<span>${escapeHtml(a.text)}</span>`;
    el.innerHTML = `${txt}<button type="button" aria-label="Dismiss">✕</button>`;
    el.querySelector('button').addEventListener('click', () => { try { localStorage.setItem('exampro-ann-' + a.id, '1'); } catch (e) {} el.remove(); });
    wrap.appendChild(el);
  }
  if (wrap.children.length) document.body.insertBefore(wrap, document.body.firstChild);
})();

/* ---------- PWA: service worker + install banner ---------- */
(function pwa() {
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  let deferred = null;
  const DISMISS = 'exampro-install-dismissed';
  const recentlyDismissed = () => { const t = +store.get(DISMISS, 0); return t && Date.now() - t < 7 * 864e5; };

  function bannerHtml(ios) {
    return `<div class="install-banner" id="installBanner" role="dialog" aria-label="Install ExamPro">
      <div class="ib-ico">EP</div>
      <div class="ib-txt"><strong>Install the ExamPro app</strong><span>${ios ? 'Tap <b>Share</b> then <b>Add to Home Screen</b>. Opens full-screen and works offline.' : 'Opens like an app, loads instantly and keeps working offline.'}</span></div>
      <div class="ib-btns">${ios ? '' : '<button type="button" class="btn btn-primary" id="ibInstall">Install</button>'}<button type="button" class="btn btn-ghost" id="ibLater">${ios ? 'Got it' : 'Not now'}</button></div></div>`;
  }
  function showBanner(ios) {
    if (standalone || recentlyDismissed() || document.getElementById('installBanner')) return;
    if ((document.body.getAttribute('data-page') || '') === 'admin') return;
    document.body.insertAdjacentHTML('beforeend', bannerHtml(ios));
    const b = document.getElementById('installBanner');
    requestAnimationFrame(() => b.classList.add('show'));
    const close = () => { b.classList.remove('show'); setTimeout(() => b.remove(), 300); };
    document.getElementById('ibLater').addEventListener('click', () => { store.set(DISMISS, Date.now()); close(); track('install_dismissed'); });
    const ib = document.getElementById('ibInstall'); if (ib) ib.addEventListener('click', () => { close(); doInstall(); });
  }
  function doInstall() {
    if (!deferred) { showToast('To install: open your browser menu and choose “Install app” / “Add to Home Screen”.'); return; }
    deferred.prompt();
    deferred.userChoice.then(c => { track(c.outcome === 'accepted' ? 'install_accepted' : 'install_declined'); deferred = null; const m = document.getElementById('installMenuItem'); if (m) m.classList.add('hide'); });
  }
  window.ExamProInstall = doInstall;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferred = e; track('install_available');
    const m = document.getElementById('installMenuItem');
    if (m && !standalone) { m.classList.remove('hide'); m.addEventListener('click', ev => { ev.preventDefault(); doInstall(); }); }
    setTimeout(() => showBanner(false), 2500);
  });
  window.addEventListener('appinstalled', () => { track('app_installed'); const b = document.getElementById('installBanner'); if (b) b.remove(); showToast('ExamPro installed — find it on your home screen'); });

  /* iOS Safari never fires beforeinstallprompt, so show the manual hint */
  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  if (isIOS && !standalone) setTimeout(() => showBanner(true), 4000);

  /* service worker */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        const offerUpdate = w => {
          if (!w || document.getElementById('updateBar')) return;
          document.body.insertAdjacentHTML('beforeend', '<div class="update-bar" id="updateBar"><span>A new version of ExamPro is ready.</span><button type="button" class="btn btn-primary" id="updBtn">Refresh</button></div>');
          document.getElementById('updBtn').addEventListener('click', () => { w.postMessage('SKIP_WAITING'); });
        };
        if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w); });
        });
      }).catch(() => {});
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
    });
    /* offline / online indicator */
    const net = () => { if (!navigator.onLine) showToast('You are offline — saved pages and your progress still work.'); else if (net.was === false) showToast('Back online'); net.was = navigator.onLine; };
    window.addEventListener('offline', net); window.addEventListener('online', net);
  }
})();

/* ---------- PROMO CAROUSEL (markup lives in index.html; slides can be replaced from admin) ---------- */
const DEFAULT_PROMOS = [
  { badge: 'Limited Offer', title: 'Get Flat 30% Scholarship', sub: 'On ExamPro Premium plans — SSC, Railway, BPSC & Banking mock tests.', cta: 'Register Now →', href: 'pricing.html', img: 'images/promo-1.jpg', emoji: '🎓' },
  { badge: 'Just Launched', title: 'SSC CGL 2026 Mock Series', sub: 'Full-length tests in real CBT interface with detailed analytics.', cta: 'Start Practicing →', href: 'tests.html', img: 'images/promo-2.jpg', emoji: '📝' },
  { badge: '100% Free', title: 'Start Free. No Card Needed.', sub: 'Daily quizzes, mock tests and analytics — free forever.', cta: 'Create Account →', href: 'register.html', img: 'images/promo-3.jpg', emoji: '🚀' },
  { badge: 'For Bihar Aspirants', title: 'BPSC · Bihar Police · BSSC', sub: 'Bilingual practice material in Hindi & English with PYQs.', cta: 'Explore Exams →', href: 'exams.html', img: 'images/promo-4.jpg', emoji: '📚' },
  { badge: 'Updated Daily', title: 'Current Affairs Quiz', sub: '10 fresh questions every day — stay ahead of the exam.', cta: "Take Today's Quiz →", href: 'current-affairs.html', img: 'images/promo-5.jpg', emoji: '📰' }
];
function promoSlideHtml(p, i) {
  return `<div class="promo-slide${i === 0 ? ' active' : ''}">
    <a href="${escapeHtml(p.href || '#')}" aria-label="${escapeHtml(p.title)}">
      ${p.img ? `<img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.alt || p.title)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : ''}
      <div class="promo-slide-fallback" style="display:${p.img ? 'none' : 'flex'};">
        <div class="promo-fb-text">
          ${p.badge ? `<span class="promo-fb-badge">${escapeHtml(p.badge)}</span>` : ''}
          <div class="promo-fb-title">${escapeHtml(p.title)}</div>
          <div class="promo-fb-sub">${escapeHtml(p.sub || '')}</div>
          ${p.cta ? `<span class="promo-fb-cta">${escapeHtml(p.cta)}</span>` : ''}
        </div>
        <div class="promo-fb-visual">${escapeHtml(p.emoji || '⭐')}</div>
      </div>
    </a></div>`;
}
function initPromoCarousel() {
  const root = document.getElementById('promoCarousel'); if (!root) return null;
  const track = root.querySelector('.promo-track');
  if (Array.isArray(CONTENT.promos) && CONTENT.promos.length) track.innerHTML = CONTENT.promos.map(promoSlideHtml).join('');
  const slides = [...root.querySelectorAll('.promo-slide')];
  if (!slides.length) { root.style.display = 'none'; return null; }
  const dotsBox = document.getElementById('promoDots'), fill = document.getElementById('promoProgress');
  const prev = document.getElementById('promoPrev'), next = document.getElementById('promoNext');
  const INTERVAL = 5500, reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let idx = Math.max(0, slides.findIndex(s => s.classList.contains('active'))), paused = false, start = performance.now(), raf = null;
  dotsBox.innerHTML = slides.map((_, i) => `<button type="button" role="tab" aria-label="Go to slide ${i + 1}"></button>`).join('');
  const dots = [...dotsBox.children];
  const multi = slides.length > 1;
  if (!multi) { prev.style.display = next.style.display = dotsBox.style.display = 'none'; root.querySelector('.promo-progress').style.display = 'none'; }

  function show(i, user) {
    idx = (i + slides.length) % slides.length;
    slides.forEach((s, k) => { s.classList.toggle('active', k === idx); s.setAttribute('aria-hidden', String(k !== idx)); const a = s.querySelector('a'); if (a) a.tabIndex = k === idx ? 0 : -1; });
    dots.forEach((d, k) => { d.classList.toggle('on', k === idx); d.setAttribute('aria-selected', String(k === idx)); });
    start = performance.now(); fill.style.width = '0%';
  }
  function loop(now) {
    if (!paused && multi && !reduced) {
      const p = Math.min(1, (now - start) / INTERVAL); fill.style.width = (p * 100).toFixed(1) + '%';
      if (p >= 1) show(idx + 1);
    } else { start = now - (parseFloat(fill.style.width) || 0) / 100 * INTERVAL; }
    raf = requestAnimationFrame(loop);
  }
  prev.addEventListener('click', () => show(idx - 1, true));
  next.addEventListener('click', () => show(idx + 1, true));
  dots.forEach((d, i) => d.addEventListener('click', () => show(i, true)));
  root.addEventListener('mouseenter', () => { paused = true; }); root.addEventListener('mouseleave', () => { paused = false; });
  root.addEventListener('focusin', () => { paused = true; }); root.addEventListener('focusout', () => { paused = false; });
  root.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(idx - 1, true); else if (e.key === 'ArrowRight') show(idx + 1, true); });
  let tx = null;
  root.addEventListener('touchstart', e => { tx = e.touches[0].clientX; paused = true; }, { passive: true });
  root.addEventListener('touchend', e => { if (tx !== null) { const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1), true); } tx = null; paused = false; }, { passive: true });
  document.addEventListener('visibilitychange', () => { paused = document.hidden; });
  show(idx); raf = requestAnimationFrame(loop);
  return { show, count: slides.length };
}
document.addEventListener('DOMContentLoaded', () => { try { initPromoCarousel(); } catch (e) { console.error(e); } });

/* ---------- TEAM (About page + landing) — put photos in /images ---------- */
const TEAM = [
  { name: 'Abhishek Kumar', role: 'Founder & CEO', img: 'images/team-abhishek.jpeg', line: 'Leads the vision, product and partnerships of ExamPro.' },
  { name: 'Praveen Kumar', role: 'Co-founder & Head of Content', img: 'images/team-praveen.jpg', line: 'Leads question-bank quality, study notes and exam content.' }
];
function renderTeam(el, compact) {
  if (!el) return;
  el.innerHTML = TEAM.map(p => {
    const ini = p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `<div class="team-card${compact ? ' compact' : ''}">
      <div class="team-photo"><span class="team-ini">${escapeHtml(ini)}</span><img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}, ${escapeHtml(p.role)}" loading="lazy" onerror="this.remove()"></div>
      <h3>${escapeHtml(p.name)}</h3><div class="team-role">${escapeHtml(p.role)}</div>${compact ? '' : `<p>${escapeHtml(p.line)}</p>`}</div>`;
  }).join('');
}

/* ---------- WAYS TO PRACTISE (test types) ---------- */
const TEST_TYPES = [
  { ico: '🎓', t: 'Exam-wise Test', d: 'Target one exam', href: 'exams.html' },
  { ico: '📚', t: 'Subject-wise Test', d: 'Focused practice', href: 'tests.html#custom' },
  { ico: '📖', t: 'Chapter-wise Test', d: 'Deep dive', href: 'practice.html' },
  { ico: '🔖', t: 'Topic-wise Test', d: 'Micro practice', href: 'practice.html' },
  { ico: '📅', t: 'Year-wise Papers', d: 'PYQ practice', href: 'papers.html' },
  { ico: '🎯', t: 'Full-Length Mock', d: 'Exam-day ready', href: 'tests.html?type=Full%20Mock' },
  { ico: '🧩', t: 'Sectional Tests', d: 'One section at a time', href: 'tests.html?type=Subject' },
  { ico: '⚡', t: 'Daily Practice', d: 'Build a habit', href: 'test-attempt.html?mode=daily' },
  { ico: '📰', t: 'Daily Quizzes', d: 'Current affairs', href: 'current-affairs.html' },
  { ico: '📄', t: 'PYQ', d: 'Past questions', href: 'papers.html' },
  { ico: '⭐', t: 'Important Qs', d: 'High-yield only', href: 'test-attempt.html?mode=important' },
  { ico: '🚀', t: 'Speed Tests', d: 'Timed drills', href: 'test-attempt.html?mode=speed' },
  { ico: '🔁', t: 'Revision Tests', d: 'Reinforce learning', href: 'test-attempt.html?mode=revision' },
  { ico: '🆓', t: 'Free Mock Tests', d: 'Start free', href: 'tests.html?access=Free' },
  { ico: '👑', t: 'Premium Series', d: 'Full access', href: 'pricing.html' }
];
function renderTestTypes(el) {
  if (!el) return;
  el.innerHTML = TEST_TYPES.map(t => `<a class="type-tile" href="${t.href}"><span class="type-ico">${t.ico}</span><span class="type-txt"><b>${escapeHtml(t.t)}</b><small>${escapeHtml(t.d)}</small></span></a>`).join('');
}

/* ---------- MASTER ONE CHAPTER AT A TIME ---------- */
const MASTERY_MIN_ANSWERS = 3, MASTERY_MIN_ACCURACY = 80;
function chapterMastery() {
  const ts = topicStats(getAttempts()), map = {};
  ts.chap.forEach(c => { map[c.subject + '||' + c.chapter] = c; });
  const rows = [];
  PRACTICE_TOPICS.forEach(t => t.chapters.forEach(ch => {
    const total = QUESTIONS.filter(q => q.subject === t.subject && q.chapter === ch).length; if (!total) return;
    const c = map[t.subject + '||' + ch] || { att: 0, ok: 0 };
    const acc = c.att ? Math.round(c.ok / c.att * 100) : 0;
    const status = c.att >= MASTERY_MIN_ANSWERS && acc >= MASTERY_MIN_ACCURACY ? 'mastered' : c.att ? 'learning' : 'new';
    rows.push({ subject: t.subject, icon: t.icon, chapter: ch, total, att: c.att, ok: c.ok, acc, status });
  }));
  const order = { learning: 0, new: 1, mastered: 2 };
  const next = rows.filter(r => r.status !== 'mastered').sort((a, b) => order[a.status] - order[b.status] || (a.status === 'learning' ? a.acc - b.acc : 0))[0] || null;
  return { rows, next, mastered: rows.filter(r => r.status === 'mastered').length };
}
function chapterLink(r, n) { return 'test-attempt.html?mode=practice&subject=' + encodeURIComponent(r.subject) + '&chapter=' + encodeURIComponent(r.chapter) + '&count=' + (n || 10); }
function renderMastery(el) {
  if (!el) return;
  const m = chapterMastery(), pct = m.rows.length ? Math.round(m.mastered / m.rows.length * 100) : 0;
  const bySub = {}; m.rows.forEach(r => { (bySub[r.subject] = bySub[r.subject] || []).push(r); });
  el.innerHTML = `
    <div class="mastery-top">
      <div class="mastery-next">
        ${m.next ? `<div class="small muted" style="margin-bottom:4px">${m.next.status === 'learning' ? 'Keep going with' : 'Start with'}</div>
          <div class="mastery-name">${m.next.icon} ${escapeHtml(m.next.chapter)} <span class="muted small">· ${escapeHtml(m.next.subject)}</span></div>
          <div class="small muted" style="margin:4px 0 12px">${m.next.status === 'learning' ? `${m.next.ok}/${m.next.att} correct so far (${m.next.acc}%). Reach ${MASTERY_MIN_ACCURACY}% over ${MASTERY_MIN_ANSWERS}+ answers to master it.` : `New chapter · ${m.next.total} questions. Master it before moving on.`}</div>
          <a class="btn btn-primary" href="${chapterLink(m.next)}">${m.next.status === 'learning' ? 'Continue chapter' : 'Start chapter'} →</a>
          <a class="btn btn-outline" href="materials.html?subject=${encodeURIComponent(m.next.subject)}" style="margin-left:6px">Read notes first</a>`
        : `<div class="mastery-name">🏆 Every chapter mastered!</div><div class="small muted">Take a full mock to keep it sharp.</div>`}
      </div>
      <div class="mastery-prog"><div style="font-size:1.7rem;font-weight:800">${m.mastered}<span class="muted" style="font-size:1rem"> / ${m.rows.length}</span></div><div class="small muted">chapters mastered</div><div class="rank-bar" style="margin-top:8px"><div class="rank-fill" style="width:${pct}%"></div></div></div>
    </div>
    ${Object.keys(bySub).map(s => `<div class="mastery-sub"><div class="small" style="font-weight:700;margin-bottom:8px">${bySub[s][0].icon} ${escapeHtml(s)}</div><div class="chapter-chips">${bySub[s].map(r => `<a class="chapter-chip mastery-${r.status}" href="${chapterLink(r)}" title="${r.status === 'new' ? 'Not started' : r.acc + '% accuracy'}">${r.status === 'mastered' ? '✓ ' : ''}${escapeHtml(r.chapter)}${r.status === 'learning' ? ' · ' + r.acc + '%' : ''}</a>`).join('')}</div></div>`).join('')}
    <p class="small muted" style="margin-top:12px">A chapter counts as mastered at ${MASTERY_MIN_ACCURACY}%+ accuracy over at least ${MASTERY_MIN_ANSWERS} answered questions.</p>`;
}


/* =====================================================================
   v4 — optional server features (student portal, admin login, visitor counting)
   These run only when the ExamPro Node server is serving the site (it sets the
   ep_srv cookie). On Live Server / static hosting nothing here calls the network.
   ===================================================================== */
const SERVER_MODE = /(?:^|;\s*)ep_srv=1/.test(document.cookie);
function serverPost(path, body) {
  return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
}
(function serverFeatures() {
  const page = (document.body && document.body.getAttribute('data-page')) || '';
  /* clean URLs only exist on the server; elsewhere point to the portal pages directly */

  /* Admin Login popup (footer button) */
  function openAdminLogin() {
    if (document.getElementById('almOverlay')) return;
    const prev = document.activeElement, ov = document.createElement('div');
    ov.id = 'almOverlay'; ov.className = 'alm-overlay';
    ov.innerHTML = `<form class="alm-dialog" role="dialog" aria-modal="true" aria-labelledby="almT" novalidate>
      <h3 id="almT">Admin login</h3><p class="small muted" style="margin:4px 0 10px">Authorised staff only. Actions are logged.</p>
      ${SERVER_MODE ? '' : '<div class="alm-note">Admin login needs the ExamPro server, which is not available on this page (static hosting / Live Server). Run <code>npm start</code> (or <b>start.bat</b>) and open <b>http://localhost:3000</b>, or use the offline content editor below.</div>'}
      <label for="almE">Email</label><input id="almE" type="email" autocomplete="username" required>
      <label for="almP" style="margin-top:10px">Password</label><input id="almP" type="password" autocomplete="current-password" required>
      <div class="alm-err" id="almErr" role="alert"></div>
      <div class="alm-actions">${SERVER_MODE ? '' : '<a class="btn btn-outline" href="admin.html" style="margin-right:auto">Content editor</a>'}<button type="button" class="btn btn-outline" id="almX">Cancel</button><button type="submit" class="btn btn-primary" id="almGo">Sign in</button></div></form>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); };
    const onKey = e => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', onKey);
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    document.getElementById('almX').addEventListener('click', close);
    document.getElementById('almE').focus();
    ov.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault(); const err = document.getElementById('almErr'), go = document.getElementById('almGo'); err.textContent = '';
      const em = document.getElementById('almE').value.trim(), pw = document.getElementById('almP').value;
      if (!em || !pw) { err.textContent = 'Enter your email and password.'; return; }
      if (!SERVER_MODE) { err.textContent = 'Server not running — see the note above.'; return; }
      go.disabled = true;
      try {
        const r = await serverPost('/api/admin/login', { email: em, password: pw }), j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Sign-in failed.');
        location.href = '/admin/dashboard';
      } catch (ex) { err.textContent = ex.message || 'Could not reach the server.'; go.disabled = false; }
    });
  }
  document.addEventListener('click', e => { const b = e.target.closest('.js-admin-login'); if (b) { e.preventDefault(); openAdminLogin(); } });

  /* visitor counting + heartbeat (server only; counted once per browser per day on the server) */
  if (SERVER_MODE && page !== 'admin') {
    serverPost('/api/visit').catch(() => {});
    setInterval(() => { if (!document.hidden) serverPost('/api/heartbeat').catch(() => {}); }, 60000);
  }
})();
