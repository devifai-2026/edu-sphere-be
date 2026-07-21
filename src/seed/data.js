/**
 * Seed data — a faithful copy of the RN app's mock arrays (src/data/*), so the
 * seeded DB gives the app parity content on day one. This is the migration path
 * off hardcoded data. Keep in sync with the app until the app stops importing mock.
 */

export const colleges = [
  'D. Y. Patil Institute of Technology, Pimpri',
  'Sinhgad College of Engineering, Vadgaon',
  'AISSMS Institute of Information Technology',
  'Bharati Vidyapeeth College of Engineering',
  'Army Institute of Technology (AIT), Pune',
];
export const streams = ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil'];
export const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
export const degrees = ['B.Tech', 'B.E.', 'B.Sc', 'M.Tech', 'MCA', 'BCA'];

const C = {
  blue: ['#FF8A4C', '#FF6B2C'],
  cyan: ['#2F6BFF', '#1E88E5'],
  violet: ['#7C3AED', '#A855F7'],
  green: ['#16A34A', '#0FB6C0'],
  amber: ['#F5A524', '#F59E0B'],
  pink: ['#F2545B', '#EC4899'],
};

/** slug → subject. Mirrors the master `S` map in catalog.ts. */
export const subjects = {
  m1: { title: 'Engineering Mathematics I', icon: 'calculator', colors: C.blue },
  m2: { title: 'Engineering Mathematics II', icon: 'calculator', colors: C.blue },
  phy: { title: 'Engineering Physics', icon: 'planet', colors: C.cyan },
  chem: { title: 'Engineering Chemistry', icon: 'flask', colors: C.green },
  cprog: { title: 'Programming in C', icon: 'code-slash', colors: C.violet },
  eg: { title: 'Engineering Graphics', icon: 'cube', colors: C.amber },
  bee: { title: 'Basic Electrical Engineering', icon: 'flash', colors: C.amber },
  bme: { title: 'Basic Mechanical Engineering', icon: 'cog', colors: C.pink },
  evs: { title: 'Environmental Studies', icon: 'leaf', colors: C.green },
  comm: { title: 'Communication Skills', icon: 'chatbubbles', colors: C.pink },
  dsa: { title: 'Data Structures & Algorithms', icon: 'git-branch', colors: C.blue },
  oop: { title: 'Object Oriented Programming', icon: 'layers', colors: C.violet },
  dbms: { title: 'Database Management Systems', icon: 'server', colors: C.green },
  os: { title: 'Operating Systems', icon: 'hardware-chip', colors: C.cyan },
  cn: { title: 'Computer Networks', icon: 'globe', colors: C.cyan },
  dld: { title: 'Digital Logic Design', icon: 'hardware-chip', colors: C.amber },
  toc: { title: 'Theory of Computation', icon: 'infinite', colors: C.violet },
  coa: { title: 'Computer Organization & Architecture', icon: 'hardware-chip', colors: C.pink },
  dm: { title: 'Discrete Mathematics', icon: 'calculator', colors: C.blue },
  daa: { title: 'Design & Analysis of Algorithms', icon: 'analytics', colors: C.blue },
  se: { title: 'Software Engineering', icon: 'construct', colors: C.green },
  web: { title: 'Web Technologies', icon: 'globe', colors: C.cyan },
  ml: { title: 'Machine Learning', icon: 'sparkles', colors: C.violet },
  ai: { title: 'Artificial Intelligence', icon: 'bulb', colors: C.violet },
  cd: { title: 'Compiler Design', icon: 'code-working', colors: C.amber },
  cc: { title: 'Cloud Computing', icon: 'cloud', colors: C.cyan },
  cyber: { title: 'Cyber Security', icon: 'shield-checkmark', colors: C.pink },
  sd: { title: 'System Design', icon: 'cube', colors: C.amber },
  mp: { title: 'Microprocessors', icon: 'hardware-chip', colors: C.cyan },
  edc: { title: 'Electronic Devices & Circuits', icon: 'flash', colors: C.amber },
  sig: { title: 'Signals & Systems', icon: 'pulse', colors: C.cyan },
  thermo: { title: 'Thermodynamics', icon: 'thermometer', colors: C.pink },
  som: { title: 'Strength of Materials', icon: 'barbell', colors: C.amber },
};

/**
 * Eligibility rules. college === '*' means wildcard (all colleges).
 * Mirrors subjectsByKey + the per-stream year fallbacks in getSubjects().
 */
export const eligibility = [
  // Common 1st year (all colleges) — from subjectsByKey '*|stream|1st Year'
  { college: '*', stream: 'Computer Science', year: '1st Year', subjects: ['m1', 'phy', 'chem', 'cprog', 'eg', 'bee', 'evs', 'comm'] },
  { college: '*', stream: 'Information Technology', year: '1st Year', subjects: ['m1', 'phy', 'chem', 'cprog', 'eg', 'bee', 'evs', 'comm'] },
  { college: '*', stream: 'Electronics', year: '1st Year', subjects: ['m1', 'phy', 'chem', 'cprog', 'eg', 'bee', 'bme', 'evs'] },
  { college: '*', stream: 'Mechanical', year: '1st Year', subjects: ['m1', 'phy', 'chem', 'eg', 'bee', 'bme', 'evs', 'comm'] },
  { college: '*', stream: 'Civil', year: '1st Year', subjects: ['m1', 'phy', 'chem', 'eg', 'bme', 'evs', 'comm'] },
  // College-specific CS 2nd year
  { college: 'D. Y. Patil Institute of Technology, Pimpri', stream: 'Computer Science', year: '2nd Year', subjects: ['dsa', 'oop', 'dld', 'dm', 'coa', 'cprog'] },
  { college: 'Sinhgad College of Engineering, Vadgaon', stream: 'Computer Science', year: '2nd Year', subjects: ['dsa', 'dbms', 'cn', 'oop', 'coa', 'dm'] },
  // Generic per-stream year sets (wildcard) — from CS_BY_YEAR / IT_BY_YEAR / ECE_BY_YEAR
  { college: '*', stream: 'Computer Science', year: '2nd Year', subjects: ['dsa', 'oop', 'dbms', 'dld', 'dm', 'coa', 'm2'] },
  { college: '*', stream: 'Computer Science', year: '3rd Year', subjects: ['os', 'cn', 'daa', 'toc', 'se', 'web', 'mp'] },
  { college: '*', stream: 'Computer Science', year: '4th Year', subjects: ['ml', 'ai', 'cc', 'cyber', 'cd', 'sd', 'web'] },
  { college: '*', stream: 'Information Technology', year: '2nd Year', subjects: ['dsa', 'oop', 'dbms', 'web', 'dm', 'coa'] },
  { college: '*', stream: 'Information Technology', year: '3rd Year', subjects: ['os', 'cn', 'daa', 'se', 'web', 'cc'] },
  { college: '*', stream: 'Information Technology', year: '4th Year', subjects: ['ml', 'cc', 'cyber', 'sd', 'web', 'ai'] },
  { college: '*', stream: 'Electronics', year: '2nd Year', subjects: ['edc', 'dld', 'sig', 'm2', 'cprog'] },
  { college: '*', stream: 'Electronics', year: '3rd Year', subjects: ['mp', 'cn', 'sig', 'coa'] },
  { college: '*', stream: 'Electronics', year: '4th Year', subjects: ['ml', 'cc', 'cyber', 'sd'] },
];

const SAMPLE_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

/** Chapters → topics → videos, keyed by subject slug. Mirrors chaptersBySubject. */
export const chapters = {
  dsa: [
    {
      title: 'Arrays & Strings',
      topics: [
        {
          title: 'Introduction to Arrays',
          videos: [
            { title: 'Arrays explained', youtubeId: 'pmN9ExDf3yQ', duration: '12:04', speedup: true, noteUrl: SAMPLE_PDF, noteLabel: 'Arrays — Lecture Notes.pdf' },
            { title: 'Array operations & complexity', youtubeId: 'NTHVTY6w2Co', duration: '15:30' },
          ],
        },
        { title: 'String Algorithms', videos: [{ title: 'Pattern matching basics', youtubeId: 'V5-7GzOfADQ', duration: '18:22' }] },
      ],
    },
    {
      title: 'Linked Lists',
      topics: [{ title: 'Singly Linked Lists', videos: [{ title: 'Linked list fundamentals', youtubeId: 'R9PTBwOzceo', duration: '20:10', speedup: true }] }],
    },
  ],
  cprog: [
    {
      title: 'C Basics',
      topics: [{ title: 'Variables & Data Types', videos: [{ title: 'C programming for beginners', youtubeId: 'KJgsSFOSQv0', duration: '14:00', speedup: true }] }],
    },
  ],
};

/** PYQs keyed by subject slug. Mirrors pyqsBySubject. */
export const pyqs = {
  dsa: [2024, 2023, 2022, 2021, 2020].map((y, i) => ({
    subjectLabel: 'Data Structures', examYear: y, semester: i % 2 === 0 ? 'End Sem' : 'Mid Sem', pages: 6 + (i % 3), pdfUrl: SAMPLE_PDF,
  })),
  cprog: [2024, 2023, 2022, 2021, 2020].map((y, i) => ({
    subjectLabel: 'Programming in C', examYear: y, semester: i % 2 === 0 ? 'End Sem' : 'Mid Sem', pages: 5 + (i % 3), pdfUrl: SAMPLE_PDF,
  })),
};

/** Tests. stream/year matched by name → resolved to ids at seed time. */
export const tests = [
  {
    title: 'DSA Sprint — MCQ', type: 'mcq', stream: 'Computer Science', year: '2nd Year', durationMin: 20, icon: 'flash', colors: ['#FF8A4C', '#FF6B2C'],
    mcq: [
      { prompt: 'Time complexity of search in a balanced BST?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], correct: 1 },
      { prompt: 'Which structure is FIFO?', options: ['Stack', 'Queue', 'Tree', 'Graph'], correct: 1 },
      { prompt: 'Average lookup in a good hash table?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'], correct: 2 },
    ],
  },
  {
    title: 'OS Concepts — Descriptive', type: 'descriptive', stream: 'Computer Science', year: '2nd Year', durationMin: 40, icon: 'document-text', colors: ['#2F6BFF', '#1E88E5'],
    descriptive: [
      { prompt: 'Explain the difference between process and thread with an example.', maxWords: 250 },
      { prompt: 'What is a deadlock? List the four Coffman conditions.', maxWords: 200 },
    ],
  },
  {
    title: 'Aptitude Mock #12', type: 'mcq', stream: 'Computer Science', year: '1st Year', durationMin: 35, icon: 'calculator', colors: ['#16A34A', '#0FB6C0'],
    mcq: [
      { prompt: 'If 3x = 18, x = ?', options: ['3', '6', '9', '12'], correct: 1 },
      { prompt: 'Next number: 2, 6, 12, 20, ?', options: ['28', '30', '32', '36'], correct: 1 },
    ],
  },
  {
    title: 'DBMS — Descriptive', type: 'descriptive', stream: 'Computer Science', year: '2nd Year', durationMin: 30, icon: 'document-text', colors: ['#FF7A3C', '#F2545B'],
    descriptive: [
      { prompt: 'Explain normalization and describe 1NF, 2NF and 3NF with examples.', maxWords: 300 },
      { prompt: 'What is the difference between a primary key and a foreign key?', maxWords: 150 },
    ],
  },
];

export const announcements = [
  { title: 'DSA Sprint Test is live', body: 'A new MCQ test for 2nd-year CSE is now open. You can attempt it multiple times — your best score counts on the leaderboard. Closes Sunday 11:59 PM.', tag: 'Test', icon: 'flash' },
  { title: 'Stripe Internship drive', body: 'SpeedUp Infotech has partnered with Stripe for SDE intern roles. Eligible students can apply from the Jobs tab. Last date to apply: this Friday.', tag: 'Job', icon: 'briefcase' },
  { title: 'New lecture series uploaded', body: 'Fresh "Presented by SpeedUp Infotech" lectures for Data Structures — Linked Lists & Trees — are now available in the Learn tab.', tag: 'General', icon: 'videocam' },
  { title: 'Weekly Coding Contest', body: 'Join the weekly coding contest every Saturday at 8 PM. Top performers get featured on the global leaderboard.', tag: 'Event', icon: 'trophy' },
];

export const banners = [
  { title: 'SpeedUp Placement Bootcamp', subtitle: 'Free 6-week crash course for 2026 batch', cta: 'Enroll free', colors: ['#FF7A3C', '#F2545B'], icon: 'rocket', order: 0 },
  { title: 'Weekly Coding Contest', subtitle: 'Compete every Saturday · win goodies', cta: 'Join now', colors: ['#2F6BFF', '#7C3AED'], icon: 'trophy', order: 1 },
  { title: 'New lecture series live', subtitle: 'DSA by SpeedUp Infotech mentors', cta: 'Watch', colors: ['#16A34A', '#0FB6C0'], icon: 'play-circle', order: 2 },
];

export const jobs = [
  { role: 'SDE Intern', company: 'Stripe', type: 'Internship', stipend: '₹1.2L / mo', location: 'Remote', skills: ['React', 'Node', 'SQL'], logoColor: ['#5B8CFF', '#7C5CFC'] },
  { role: 'Frontend Engineer', company: 'Linear', type: 'Full-time', stipend: '₹28 LPA', location: 'Bangalore', skills: ['React', 'TypeScript'], logoColor: ['#39E0E8', '#3B6EF5'] },
  { role: 'ML Research Intern', company: 'OpenAI', type: 'Internship', stipend: '₹2L / mo', location: 'Hybrid', skills: ['Python', 'PyTorch'], logoColor: ['#A855F7', '#EC4899'] },
  { role: 'Backend Engineer', company: 'Razorpay', type: 'Full-time', stipend: '₹22 LPA', location: 'Bangalore', skills: ['Go', 'Postgres'], logoColor: ['#34D399', '#0FB6C0'] },
];

export const notifications = [
  { category: 'Tests', title: 'New test unlocked', body: 'Weekly Coding Contest starts in 2 hours', icon: 'flash', unread: true },
  { category: 'Jobs', title: 'Stripe is hiring', body: 'SDE Intern role matches your profile', icon: 'briefcase', unread: true },
  { category: 'Community', title: 'Aarav mentioned you', body: 'in DSA Warriors group', icon: 'people', unread: false },
  { category: 'Announcements', title: 'Placement season begins', body: 'Complete your readiness checklist', icon: 'megaphone', unread: false },
];

export const faqs = [
  { q: 'How do I attempt a test?', a: 'Open the Tests tab, pick a test eligible for your year & stream, and tap Start. You can retake tests anytime.', order: 0 },
  { q: 'Are the lecture videos free?', a: 'Yes. All videos are free and unlocked. Some are presented by SpeedUp Infotech.', order: 1 },
  { q: 'How do PYQs work?', a: 'Previous-year papers are filtered by your college, stream and year, available as PDFs to view or download.', order: 2 },
];

export const resumeConfig = {
  key: 'default',
  suggestions: [
    { icon: 'add-circle', text: 'Add a "Projects" section with measurable impact', tone: 'warning' },
    { icon: 'trending-up', text: 'Use stronger action verbs (led, shipped, optimized)', tone: 'primary' },
    { icon: 'pricetag', text: 'Include keywords: React, REST, CI/CD for ATS match', tone: 'primary' },
    { icon: 'remove-circle', text: 'Trim to a single page — currently 2.3 pages', tone: 'danger' },
  ],
  missing: ['Certifications', 'Achievements', 'GitHub link'],
};

// Member counts are NOT seeded — they are computed from real memberIds at serialize time.
// The seed script enrolls the demo users into these groups so counts start realistic.
export const groups = [
  { name: 'CSE 2nd Year — Official', icon: 'school', official: true, lastMsg: '' },
  { name: 'Placement Prep 2026', icon: 'briefcase', official: true, lastMsg: '' },
  { name: 'DSA Study Buddies', icon: 'people', official: false, lastMsg: '' },
];

/** Seed users — a primary demo student + a few others for the leaderboard. */
export const users = [
  {
    phone: '9812345621', firstName: 'Subhojit', lastName: 'Dutta', email: 'subhojit.dutta@gmail.com',
    college: 'Army Institute of Technology (AIT), Pune', degree: 'B.Tech', stream: 'Computer Science', year: '3rd Year',
    subjects: ['dsa', 'os', 'dbms'], skills: ['React', 'TypeScript', 'Node.js', 'Python', 'DSA'], hasResume: true,
    streak: 24, placementScore: 78, testsCompleted: 86, score: 9840,
    readiness: [
      { label: 'Aptitude', value: 82, icon: 'calculator', colors: ['#5B8CFF', '#7C5CFC'] },
      { label: 'Coding', value: 74, icon: 'code-slash', colors: ['#39E0E8', '#3B6EF5'] },
      { label: 'Resume', value: 68, icon: 'document-text', colors: ['#A855F7', '#EC4899'] },
      { label: 'Communication', value: 88, icon: 'chatbubbles', colors: ['#34D399', '#0FB6C0'] },
    ],
    projects: [
      { title: 'EduSphere Clone', meta: 'React Native • Expo', stars: 128, icon: 'planet' },
      { title: 'Realtime Chat App', meta: 'Socket.io • Node', stars: 64, icon: 'chatbubbles' },
      { title: 'ML Stock Predictor', meta: 'Python • TensorFlow', stars: 92, icon: 'trending-up' },
    ],
    certificates: [
      { title: 'AWS Cloud Practitioner', issuer: 'Amazon', year: '2025', icon: 'cloud' },
      { title: 'Meta Front-End Developer', issuer: 'Coursera', year: '2024', icon: 'logo-react' },
    ],
  },
  { phone: '9900000002', firstName: 'Aarav', lastName: 'Mehta', college: 'Sinhgad College of Engineering, Vadgaon', stream: 'Computer Science', year: '2nd Year', score: 9720 },
  { phone: '9900000003', firstName: 'Diya', lastName: 'Sharma', college: 'AISSMS Institute of Information Technology', stream: 'Information Technology', year: '2nd Year', score: 9610 },
  { phone: '9900000004', firstName: 'Kabir', lastName: 'Singh', college: 'Army Institute of Technology (AIT), Pune', stream: 'Computer Science', year: '3rd Year', score: 9430 },
  { phone: '9900000005', firstName: 'Ananya', lastName: 'Rao', college: 'D. Y. Patil Institute of Technology, Pimpri', stream: 'Electronics', year: '2nd Year', score: 9280 },
];

/** Theme overrides — mirror darkColors / darkGradients so the app renders identically. */
export const theme = {
  key: 'active',
  label: 'EduSphere Dark',
  colors: {
    bg: '#0B1020', bgElevated: '#111827', surface: '#151B2F', surfaceAlt: '#1F2937',
    glass: 'rgba(24, 31, 48, 0.92)', glassBorder: 'rgba(255, 255, 255, 0.07)', glassHighlight: 'rgba(255, 255, 255, 0.05)',
    text: '#F8FAFC', textMuted: '#9CA8BE', textFaint: '#5B6580', textInverse: '#FFFFFF',
    primary: '#FF6B2C', primaryAlt: '#FF8A4C', indigo: '#2F6BFF', cyan: '#3BA9FF', violet: '#8B5CF6',
    success: '#22C55E', warning: '#F5A524', danger: '#F2545B',
    border: 'rgba(255,255,255,0.07)', overlay: 'rgba(5, 8, 18, 0.72)', shadow: '#000000',
  },
  gradients: {
    brand: ['#FF7A3C', '#FF6B2C', '#F2545B'], brandSoft: ['#FF8A4C', '#FF6B2C'],
    mesh1: ['#141A2B', '#0B1020'], mesh2: ['#171B2E', '#0B1020'],
    card: ['rgba(255,107,44,0.06)', 'rgba(47,107,255,0.04)'], gold: ['#F5A524', '#F59E0B'],
  },
  active: true,
};
