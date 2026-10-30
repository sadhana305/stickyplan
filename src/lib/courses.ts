export type Course = {
  id: string;
  title: string;
  platform: string;
  url: string;
  category: string;
  level: string;
  pricing: "FREE" | "FREE_AUDIT" | "PAID" | "FREEMIUM";
  pricingLabel: string;
  description: string;
};

/**
 * Curated catalogue of genuine, well-known courses on the recommended
 * learning platforms. Every URL points to a real, stable official page.
 */
export const COURSES: Course[] = [
  // Programming
  { id: "fcc-learn", title: "freeCodeCamp Full Curriculum", platform: "freeCodeCamp", url: "https://www.freecodecamp.org/learn/", category: "Programming", level: "Beginner → Advanced", pricing: "FREE", pricingLabel: "Free", description: "Hands-on certifications in web, Python, data analysis and more — completely free with a supportive community." },
  { id: "cs50x", title: "CS50's Introduction to Computer Science", platform: "edX (Harvard)", url: "https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science", category: "Programming", level: "Beginner", pricing: "FREE_AUDIT", pricingLabel: "Free audit • Paid certificate", description: "Harvard's legendary intro to computer science: C, algorithms, memory, Python, SQL and web basics." },
  { id: "py4e", title: "Python for Everybody", platform: "Coursera (Michigan)", url: "https://www.coursera.org/specializations/python", category: "Programming", level: "Beginner", pricing: "FREE_AUDIT", pricingLabel: "Free audit • Paid certificate", description: "Dr. Chuck's friendly specialization taking you from zero Python to data processing." },
  { id: "mit-6100l", title: "Intro to CS and Programming Using Python", platform: "MIT OpenCourseWare", url: "https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/", category: "Programming", level: "Beginner", pricing: "FREE", pricingLabel: "Free", description: "Full MIT lecture series with assignments and exams — rigorous, free, self-paced." },

  // Web Development
  { id: "odin", title: "The Odin Project", platform: "The Odin Project", url: "https://www.theodinproject.com/", category: "Web Development", level: "Beginner → Job-ready", pricing: "FREE", pricingLabel: "Free", description: "A full open-source curriculum for full-stack web development with real projects." },
  { id: "mdn-learn", title: "Learn Web Development", platform: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development", category: "Web Development", level: "Beginner", pricing: "FREE", pricingLabel: "Free", description: "Mozilla's structured path through HTML, CSS, JavaScript and web standards." },
  { id: "cs50w", title: "CS50's Web Programming with Python & JavaScript", platform: "edX (Harvard)", url: "https://www.edx.org/learn/web-development/harvard-university-cs50-s-web-programming-with-python-and-javascript", category: "Web Development", level: "Intermediate", pricing: "FREE_AUDIT", pricingLabel: "Free audit • Paid certificate", description: "Django, SQL, JavaScript, React and deployment — build real web applications." },
  { id: "meta-frontend", title: "Meta Front-End Developer Certificate", platform: "Coursera", url: "https://www.coursera.org/professional-certificates/meta-front-end-developer", category: "Web Development", level: "Beginner → Intermediate", pricing: "PAID", pricingLabel: "Paid certificate (audit per course)", description: "Industry-recognized certificate covering React, UI/UX and version control." },

  // Artificial Intelligence
  { id: "elements-ai", title: "Elements of AI", platform: "Univ. of Helsinki", url: "https://www.elementsofai.com/", category: "Artificial Intelligence", level: "Beginner", pricing: "FREE", pricingLabel: "Free", description: "A gentle, non-technical introduction to what AI is and what it can (and can't) do." },
  { id: "ai-everyone", title: "AI For Everyone", platform: "Coursera (DeepLearning.AI)", url: "https://www.coursera.org/learn/ai-for-everyone", category: "Artificial Intelligence", level: "Beginner", pricing: "FREE_AUDIT", pricingLabel: "Free audit • Paid certificate", description: "Andrew Ng explains AI concepts, workflows and how to spot AI opportunities — no coding needed." },
  { id: "cs50-ai", title: "CS50's Intro to AI with Python", platform: "edX (Harvard)", url: "https://www.edx.org/learn/artificial-intelligence/harvard-university-cs50-s-introduction-to-artificial-intelligence-with-python", category: "Artificial Intelligence", level: "Intermediate", pricing: "FREE_AUDIT", pricingLabel: "Free audit • Paid certificate", description: "Search, knowledge, uncertainty, learning and neural networks — concepts plus hands-on Python projects." },

  // Machine Learning
  { id: "ml-spec", title: "Machine Learning Specialization", platform: "Coursera (DeepLearning.AI)", url: "https://www.coursera.org/specializations/machine-learning-introduction", category: "Machine Learning", level: "Beginner → Intermediate", pricing: "FREE_AUDIT", pricingLabel: "Free audit • Paid certificate", description: "The updated Andrew Ng classic: regression, classification, clustering and recommender systems." },
  { id: "kaggle-ml", title: "Intro to Machine Learning", platform: "Kaggle Learn", url: "https://www.kaggle.com/learn/intro-to-machine-learning", category: "Machine Learning", level: "Beginner", pricing: "FREE", pricingLabel: "Free", description: "Short, practical notebooks — build your first models in an afternoon, no setup needed." },
  { id: "google-mlcc", title: "Machine Learning Crash Course", platform: "Google Developers", url: "https://developers.google.com/machine-learning/crash-course", category: "Machine Learning", level: "Beginner → Intermediate", pricing: "FREE", pricingLabel: "Free", description: "Google's fast-paced, visual ML crash course with interactive exercises." },

  // Data Science
  { id: "ibm-ds", title: "IBM Data Science Professional Certificate", platform: "Coursera", url: "https://www.coursera.org/professional-certificates/ibm-data-science", category: "Data Science", level: "Beginner", pricing: "PAID", pricingLabel: "Paid certificate (audit per course)", description: "Python, SQL, data analysis, visualisation and machine learning with a capstone project." },
  { id: "google-data", title: "Google Data Analytics Certificate", platform: "Coursera", url: "https://www.coursera.org/professional-certificates/google-data-analytics", category: "Data Science", level: "Beginner", pricing: "PAID", pricingLabel: "Paid certificate (7-day free trial)", description: "Spreadsheets, SQL, R and Tableau through the full data analysis lifecycle." },
  { id: "kaggle-learn", title: "Kaggle Learn Micro-Courses", platform: "Kaggle", url: "https://www.kaggle.com/learn", category: "Data Science", level: "Beginner", pricing: "FREE", pricingLabel: "Free", description: "Free bite-sized courses on Python, pandas, data visualisation and ML — all in the browser." },

  // Cybersecurity
  { id: "google-cyber", title: "Google Cybersecurity Certificate", platform: "Coursera", url: "https://www.coursera.org/professional-certificates/google-cybersecurity", category: "Cybersecurity", level: "Beginner", pricing: "PAID", pricingLabel: "Paid certificate (7-day free trial)", description: "Security fundamentals, network security, Linux, SQL and incident response." },
  { id: "tryhackme", title: "TryHackMe Cyber Security Training", platform: "TryHackMe", url: "https://tryhackme.com/", category: "Cybersecurity", level: "Beginner → Advanced", pricing: "FREEMIUM", pricingLabel: "Free tier + paid labs", description: "Learn hacking and defence in guided, browser-based virtual labs." },
  { id: "nyu-cyber", title: "Introduction to Cybersecurity", platform: "edX (NYU)", url: "https://www.edx.org/learn/cybersecurity/new-york-university-introduction-to-cybersecurity", category: "Cybersecurity", level: "Beginner", pricing: "FREE_AUDIT", pricingLabel: "Free audit • Paid certificate", description: "NYU's survey of cyber risk, attacks, cryptography and defence strategies." },

  // UI/UX Design
  { id: "google-ux", title: "Google UX Design Certificate", platform: "Coursera", url: "https://www.coursera.org/professional-certificates/google-ux-design", category: "UI/UX Design", level: "Beginner", pricing: "PAID", pricingLabel: "Paid certificate (7-day free trial)", description: "Research, wireframing, prototyping and testing — build three portfolio projects." },
  { id: "canva-school", title: "Canva Design School", platform: "Canva", url: "https://www.canva.com/designschool/", category: "UI/UX Design", level: "Beginner", pricing: "FREE", pricingLabel: "Free", description: "Free courses and tutorials on design basics, branding and visual communication." },
  { id: "calarts-graphic", title: "Graphic Design Specialization", platform: "Coursera (CalArts)", url: "https://www.coursera.org/specializations/graphic-design", category: "UI/UX Design", level: "Beginner → Intermediate", pricing: "FREE_AUDIT", pricingLabel: "Free audit • Paid certificate", description: "Typography, image-making, branding and editorial design from CalArts faculty." },

  // Digital Marketing
  { id: "google-dm", title: "Google Digital Marketing & E-commerce", platform: "Coursera", url: "https://www.coursera.org/professional-certificates/google-digital-marketing-ecommerce", category: "Digital Marketing", level: "Beginner", pricing: "PAID", pricingLabel: "Paid certificate (7-day free trial)", description: "SEO, social media, email marketing, analytics and e-commerce store strategy." },
  { id: "hubspot-dm", title: "HubSpot Digital Marketing Course", platform: "HubSpot Academy", url: "https://academy.hubspot.com/courses/digital-marketing", category: "Digital Marketing", level: "Beginner", pricing: "FREE", pricingLabel: "Free (with certificate)", description: "Free certification covering SEO, content, paid ads and reporting from HubSpot experts." },
  { id: "meta-social", title: "Meta Social Media Marketing", platform: "Coursera", url: "https://www.coursera.org/professional-certificates/facebook-social-media-marketing", category: "Digital Marketing", level: "Beginner", pricing: "FREE_AUDIT", pricingLabel: "Free audit • Paid certificate", description: "Build social media marketing skills and an e-commerce presence with Meta tools." },
];

export const PLATFORMS = [
  { name: "Coursera", url: "https://www.coursera.org/", note: "University & industry certificates" },
  { name: "edX", url: "https://www.edx.org/", note: "Free audits of top university courses" },
  { name: "Udemy", url: "https://www.udemy.com/courses/free/", note: "Frequently free practical courses" },
  { name: "freeCodeCamp", url: "https://www.freecodecamp.org/", note: "100% free coding curriculum" },
  { name: "SWAYAM", url: "https://swayam.gov.in/", note: "Government of India free courses" },
  { name: "NPTEL", url: "https://nptel.ac.in/", note: "IIT & IISc video lecture courses" },
  { name: "Khan Academy", url: "https://www.khanacademy.org/", note: "Free K-12 & early college lessons" },
];

export const COURSE_CATEGORIES = [
  "Programming",
  "Web Development",
  "Artificial Intelligence",
  "Machine Learning",
  "Data Science",
  "Cybersecurity",
  "UI/UX Design",
  "Digital Marketing",
];
