/**
 * Trawl Configuration
 * Path: /home/hub/public_html/gads/rnd/trawl-config.js
 * 
 * Central configuration for the RND keyword trawling system
 */

module.exports = {
  // Search Console settings
  searchConsole: {
    siteUrl: 'https://ulearn.ie',
    defaultDays: 30,
    minImpressions: 5,
    maxResults: 100
  },
  
  // MEI Schools (English Education Ireland members)
  meiSchools: {
    'apollo.ie': 'Apollo Language Centre',
    'atc-ireland.ie': 'ATC Language Schools',
    'atlanticlanguage.com': 'Atlantic Centre of Education',
    'atlasls.com': 'Atlas Language School',
    'avanti.ie': 'Avanti Language Institute',
    'babelacademy.com': 'Babel Academy of English',
    'berlitz.ie': 'Berlitz Dublin',
    'galwaylanguage.com': 'Bridge Mills Galway Language Centre',
    'castleforbescollege.com': 'Castleforbes College',
    'corkenglishcollege.ie': 'CEC - Cork English College',
    'ces-schools.com': 'Centre of English Studies',
    'ces-cork.ie': 'CES Cork',
    'citascollege.ie': 'Citas College Dublin',
    'citylanguageschool.com': 'City Language School',
    'corkenglishacademy.com': 'Cork English Academy',
    'delfin.ie': 'Delfin English School',
    'difc.ie': 'DIFC Ireland',
    'english.dcu.ie': 'Dublin City University International Academy',
    'dcas.ie': 'Dublin College of Advanced Studies',
    'dublinculture.com': 'Dublin Cultural Institute',
    'ecenglish.com/dublin': 'EC Dublin',
    'ef.com/dublin': 'EF International Language Schools',
    'einstein2english.ie': 'Einstein 2 English',
    'elischools.com': 'ELI Schools',
    'elta.ie': 'ELTA The School of Spoken English',
    'eci.ie': 'Emerald Cultural Institute',
    'englishgalway.ie': 'English Language Centre NUI Galway',
    'englishpath.com': 'English Path',
    'englishour.ie': 'Englishour',
    'erinschool.ie': 'Erin School of English',
    'everestlanguageschool.com': 'Everest Language School',
    'futurelearning.ie': 'Future Learning',
    'highschoolsinternational.com': 'High Schools International',
    'ibatcollege.ie': 'IBAT College Dublin',
    'ihdublin.com': 'International House Dublin',
    'iceireland.com': 'Irish College of English',
    'isidublin.com': 'ISI Dublin',
    'kaplaninternational.com/dublin': 'Kaplan International Languages',
    'learnenglish.ie': 'Limerick Language Centre',
    'mli.ie': 'MLI International Schools',
    'moylepark.ie': 'Moyle Park English Language College',
    'ohc.ie': 'OHC Dublin',
    'rightword.ie': 'Rightword',
    'shandonls.com': 'Shandon Language Solutions',
    'swandublin.com': 'Swan Training Institute',
    'hornerschool.com': 'The Horner School of English',
    'linguaviva.com': 'The Linguaviva Centre',
    'travellinglanguages.com': 'Travelling Languages',
    'twinenglishcentres.com': 'Twin English Centre Dublin',
    'ulearn.ie': 'ULearn English School',
    'ucc.ie/esol': 'University College Cork Language Centre',
    'ul.ie/languagecentre': 'University of Limerick Language Centre'
  },
  
  // Additional competitors not in MEI
  additionalCompetitors: {
    'delfinschool.com': 'Delfin School (International)',
    'franceskingdublin.com': 'Frances King School of English',
    'seda.ie': 'SEDA College',
    'eli.ie': 'English Language Institute',
    'aladublin.ie': 'ALA Dublin',
    'twintowers.ie': 'Twin Towers School',
    'griffith.ie/faculties-schools/english-language': 'Griffith College English',
    'swandean.ie': 'Swandean School of English'
  },
  
  // LATAM target markets
  markets: {
    'ARG': { name: 'Argentina', language: 'es' },
    'BRA': { name: 'Brazil', language: 'pt' },
    'MEX': { name: 'Mexico', language: 'es' },
    'COL': { name: 'Colombia', language: 'es' },
    'CHL': { name: 'Chile', language: 'es' },
    'ESP': { name: 'Spain', language: 'es' },
    'ITA': { name: 'Italy', language: 'it' },
    'FRA': { name: 'France', language: 'fr' }
  },
  
  // Intent scoring weights
  scoring: {
    weights: {
      searchConsole: {
        impressions: 2,
        clicks: 10,
        position: 5
      },
      competitor: {
        metaTag: 5,
        h1Tag: 8,
        h2Tag: 5,
        navigation: 4,
        cta: 6,
        content: 2
      }
    },
    thresholds: {
      high: 70,
      medium: 40,
      low: 0
    }
  },
  
  // Database settings
  database: {
    table: 'trawled_keywords',
    maxBatchSize: 100,
    cacheMinutes: 60
  }
};