import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getOnboarding } from '@/lib/onboarding-storage';
import { scaleFont, scaleSize, RESPONSIVE, SCREEN_WIDTH } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { OnboardingView } from '@/components/OnboardingView';

const IS_IPAD = SCREEN_WIDTH >= 768;

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

type Question = {
  text: string;
  options: string[];
  correctIndex: number;
  concept: string;
};

type QuestionSet = { easy: Question; medium: Question; hard: Question };

const QUESTION_BANK: Record<string, Record<string, QuestionSet>> = {
  biology: {
    elementary: {
      easy: { text: 'What do plants need to make food?', options: ['Sunlight, water, CO₂', 'Soil, rain, clouds', 'Heat, oxygen, salt', 'Bugs, dirt, air'], correctIndex: 0, concept: 'Photosynthesis' },
      medium: { text: 'Which organ pumps blood through your body?', options: ['Brain', 'Lungs', 'Heart', 'Liver'], correctIndex: 2, concept: 'Circulatory System' },
      hard: { text: 'A plant in a dark room produces less food. Which process explains this?', options: ['Respiration', 'Photosynthesis', 'Digestion', 'Transpiration'], correctIndex: 1, concept: 'Photosynthesis application' },
    },
    middleschool: {
      easy: { text: 'What is the powerhouse of the cell?', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Vacuole'], correctIndex: 2, concept: 'Cell organelles' },
      medium: { text: 'DNA is made of which building blocks?', options: ['Amino acids', 'Nucleotides', 'Fatty acids', 'Glucose'], correctIndex: 1, concept: 'DNA structure' },
      hard: { text: 'A mutation silences a tumor-suppressor gene. What is the most likely outcome?', options: ['Cell growth slows', 'Cell death increases', 'Uncontrolled cell division', 'Normal cell function'], correctIndex: 2, concept: 'Genetics & cancer' },
    },
    highschool: {
      easy: { text: 'Which molecule carries genetic information in a cell?', options: ['ATP', 'RNA', 'DNA', 'Protein'], correctIndex: 2, concept: 'Molecular biology' },
      medium: { text: 'During meiosis, crossing-over increases which of the following?', options: ['Mutation rate', 'Genetic variation', 'Chromosome number', 'Cell size'], correctIndex: 1, concept: 'Meiosis' },
      hard: { text: "An enzyme's active site changes shape at high temperatures. What term describes this?", options: ['Activation', 'Denaturation', 'Inhibition', 'Catabolism'], correctIndex: 1, concept: 'Enzyme function' },
    },
    college: {
      easy: { text: 'What is the central dogma of molecular biology?', options: ['DNA to RNA to Protein', 'RNA to DNA to Protein', 'Protein to DNA to RNA', 'DNA to Protein to RNA'], correctIndex: 0, concept: 'Central dogma' },
      medium: { text: 'Which type of selection favors extreme phenotypes over intermediate ones?', options: ['Stabilizing', 'Directional', 'Disruptive', 'Artificial'], correctIndex: 2, concept: 'Natural selection' },
      hard: { text: 'CRISPR-Cas9 uses guide RNA to target specific DNA sequences. What does Cas9 function as?', options: ['A helicase', 'A ligase', 'An endonuclease', 'A polymerase'], correctIndex: 2, concept: 'Genetic engineering' },
    },
  },
  chemistry: {
    elementary: {
      easy: { text: 'What happens to water when it is heated enough?', options: ['It turns to ice', 'It evaporates into steam', 'It becomes heavier', 'It changes color'], correctIndex: 1, concept: 'States of matter' },
      medium: { text: 'Which of these is a chemical change?', options: ['Cutting paper', 'Melting ice', 'Burning wood', 'Bending a straw'], correctIndex: 2, concept: 'Physical vs chemical change' },
      hard: { text: 'Iron rusts when left outside. This is an example of what type of change?', options: ['Physical change', 'State change', 'Chemical change', 'Reversible change'], correctIndex: 2, concept: 'Chemical reactions' },
    },
    middleschool: {
      easy: { text: "An atom's identity is determined by its number of:", options: ['Neutrons', 'Protons', 'Electrons', 'Quarks'], correctIndex: 1, concept: 'Atomic structure' },
      medium: { text: 'In the compound H₂O, what does the subscript 2 mean?', options: ['2 oxygen atoms', '2 water molecules', '2 hydrogen atoms', '2 bonds'], correctIndex: 2, concept: 'Chemical formulas' },
      hard: { text: 'A solution has a pH of 3. How does it compare to a solution with a pH of 6?', options: ['10x more basic', '3x more acidic', '1000x more acidic', 'Equal acidity'], correctIndex: 2, concept: 'pH scale' },
    },
    highschool: {
      easy: { text: 'What is the valence electron count of carbon?', options: ['2', '4', '6', '8'], correctIndex: 1, concept: 'Electron configuration' },
      medium: { text: 'In an exothermic reaction, products have _____ energy than reactants.', options: ['More', 'Equal', 'Less', 'Unpredictable'], correctIndex: 2, concept: 'Thermochemistry' },
      hard: { text: "Le Chatelier's principle: if pressure increases in a gaseous equilibrium, the reaction shifts toward the side with:", options: ['More moles of gas', 'Fewer moles of gas', 'Higher temperature', 'Lower concentration'], correctIndex: 1, concept: 'Chemical equilibrium' },
    },
    college: {
      easy: { text: 'Which quantum number describes the shape of an orbital?', options: ['Principal (n)', 'Angular momentum (l)', 'Magnetic (mₗ)', 'Spin (mₛ)'], correctIndex: 1, concept: 'Quantum mechanics' },
      medium: { text: 'Which intermolecular force is strongest?', options: ['London dispersion', 'Dipole-dipole', 'Hydrogen bonding', 'Ion-induced dipole'], correctIndex: 2, concept: 'Intermolecular forces' },
      hard: { text: 'A reaction is spontaneous at all temperatures. What must be true about ΔH and ΔS?', options: ['ΔH > 0, ΔS > 0', 'ΔH < 0, ΔS < 0', 'ΔH < 0, ΔS > 0', 'ΔH > 0, ΔS < 0'], correctIndex: 2, concept: 'Gibbs free energy' },
    },
  },
  math: {
    elementary: {
      easy: { text: 'What is 7 times 8?', options: ['54', '56', '63', '48'], correctIndex: 1, concept: 'Multiplication' },
      medium: { text: 'A rectangle is 6 cm long and 4 cm wide. What is its area?', options: ['10 sq cm', '20 sq cm', '24 sq cm', '48 sq cm'], correctIndex: 2, concept: 'Area' },
      hard: { text: 'Sarah has 24 stickers and gives ⅓ to her friend. How many does she have left?', options: ['8', '12', '16', '18'], correctIndex: 2, concept: 'Fractions application' },
    },
    middleschool: {
      easy: { text: 'Solve for x: 2x + 5 = 13', options: ['x = 3', 'x = 4', 'x = 6', 'x = 9'], correctIndex: 1, concept: 'Linear equations' },
      medium: { text: 'What is the area of a triangle with base 10 and height 6?', options: ['60', '30', '16', '20'], correctIndex: 1, concept: 'Geometry' },
      hard: { text: 'A store discounts a $80 item by 25%, then adds 10% tax. What is the final price?', options: ['$60.00', '$66.00', '$72.00', '$68.50'], correctIndex: 1, concept: 'Percent application' },
    },
    highschool: {
      easy: { text: 'What is the slope of y = 3x − 7?', options: ['−7', '3', '7', '−3'], correctIndex: 1, concept: 'Linear functions' },
      medium: { text: 'A quadratic equation has two solutions: x = 2 and x = 3. Which equation could it be?', options: ['x^2 - 5x + 6 = 0', 'x^2 + 5x + 6 = 0', 'x^2 - 6x + 5 = 0', 'x^2 - x - 6 = 0'], correctIndex: 0, concept: 'Quadratic equations' },
      hard: { text: 'As x approaches 0, what does the expression sin(x)/x approach?', options: ['0', 'undefined', '1', 'infinity'], correctIndex: 2, concept: 'Limits' },
    },
    college: {
      easy: { text: 'What is the derivative of f(x) = x cubed?', options: ['3x', '3x squared', 'x squared', '3x to the 4th'], correctIndex: 1, concept: 'Differentiation' },
      medium: { text: 'The integral of 2x with respect to x equals:', options: ['x + C', '2 + C', 'x squared + C', '2x squared + C'], correctIndex: 2, concept: 'Integration' },
      hard: { text: 'A matrix A is invertible if and only if:', options: ['det(A) equals 1', 'det(A) is not zero', 'A is symmetric', 'rank(A) is less than n'], correctIndex: 1, concept: 'Linear algebra' },
    },
  },
  cs: {
    elementary: {
      easy: { text: 'Which of these is an example of a computer output?', options: ['Keyboard', 'Mouse', 'Monitor', 'USB drive'], correctIndex: 2, concept: 'Input/Output' },
      medium: { text: 'In a simple program, what does a loop do?', options: ['Stops the program', 'Repeats actions', 'Deletes data', 'Starts the computer'], correctIndex: 1, concept: 'Loops' },
      hard: { text: 'A program checks: "If it is raining, take an umbrella." This is an example of:', options: ['A loop', 'A variable', 'A conditional statement', 'A function'], correctIndex: 2, concept: 'Conditionals' },
    },
    middleschool: {
      easy: { text: 'What does a variable store in programming?', options: ['A command', 'A value', 'A loop', 'A file'], correctIndex: 1, concept: 'Variables' },
      medium: { text: 'What is the output of: x = 5; x = x + 3; print(x)?', options: ['5', '3', '8', 'Error'], correctIndex: 2, concept: 'Assignment operations' },
      hard: { text: 'A function is called 5 times inside a loop that runs 3 times. How many total function calls happen?', options: ['5', '3', '15', '8'], correctIndex: 2, concept: 'Nested iteration' },
    },
    highschool: {
      easy: { text: 'What is the time complexity of accessing an element in an array by index?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n^2)'], correctIndex: 2, concept: 'Big-O notation' },
      medium: { text: 'Which data structure operates on LIFO (Last In, First Out)?', options: ['Queue', 'Stack', 'Array', 'Tree'], correctIndex: 1, concept: 'Data structures' },
      hard: { text: 'Binary search requires the input array to be:', options: ['Unsorted', 'Sorted', 'Unique values only', 'Numeric only'], correctIndex: 1, concept: 'Search algorithms' },
    },
    college: {
      easy: { text: 'What does TCP guarantee that UDP does not?', options: ['Speed', 'Reliable delivery', 'Encryption', 'Low latency'], correctIndex: 1, concept: 'Networking' },
      medium: { text: 'In object-oriented programming, encapsulation means:', options: ['Inheriting from a parent class', 'Hiding internal state and exposing only an interface', 'Running code concurrently', 'Recursively calling a function'], correctIndex: 1, concept: 'OOP principles' },
      hard: { text: 'Which normal form eliminates transitive dependencies in a relational database?', options: ['1NF', '2NF', '3NF', 'BCNF'], correctIndex: 2, concept: 'Database normalization' },
    },
  },
  history: {
    elementary: {
      easy: { text: 'Who was the first President of the United States?', options: ['Abraham Lincoln', 'George Washington', 'Thomas Jefferson', 'Benjamin Franklin'], correctIndex: 1, concept: 'US History' },
      medium: { text: 'The pyramids of Giza were built by which ancient civilization?', options: ['Romans', 'Greeks', 'Egyptians', 'Mesopotamians'], correctIndex: 2, concept: 'Ancient civilizations' },
      hard: { text: 'Christopher Columbus sailed to the Americas in 1492. Who funded his voyage?', options: ['England', 'Portugal', 'France', 'Spain'], correctIndex: 3, concept: 'Age of Exploration' },
    },
    middleschool: {
      easy: { text: 'Which war was fought between the Northern and Southern United States?', options: ['World War I', 'Revolutionary War', 'Civil War', 'Vietnam War'], correctIndex: 2, concept: 'US Civil War' },
      medium: { text: 'The Magna Carta (1215) primarily limited the power of:', options: ['The Church', 'The English king', 'Parliament', 'The military'], correctIndex: 1, concept: 'Constitutional history' },
      hard: { text: 'The Industrial Revolution began in which country before spreading globally?', options: ['France', 'Germany', 'United States', 'Great Britain'], correctIndex: 3, concept: 'Industrial Revolution' },
    },
    highschool: {
      easy: { text: 'World War I was triggered most directly by:', options: ['The invasion of Poland', 'The assassination of Archduke Franz Ferdinand', 'The sinking of the Lusitania', 'The Treaty of Versailles'], correctIndex: 1, concept: 'WWI causes' },
      medium: { text: 'The Cold War was primarily a conflict between the US and:', options: ['China', 'Germany', 'Soviet Union', 'Japan'], correctIndex: 2, concept: 'Cold War' },
      hard: { text: 'The Marshall Plan (1948) was designed primarily to:', options: ['Rebuild Europe economically to resist communism', 'Punish Germany after WWII', 'Create NATO', 'Fund the Korean War'], correctIndex: 0, concept: 'Post-WWII policy' },
    },
    college: {
      easy: { text: 'The French Revolution began in which year?', options: ['1776', '1789', '1804', '1815'], correctIndex: 1, concept: 'French Revolution' },
      medium: { text: 'Decolonization in Africa and Asia was most rapid during which decade?', options: ['1930s', '1940s', '1950s–60s', '1970s'], correctIndex: 2, concept: 'Decolonization' },
      hard: { text: "Historian Fernand Braudel's \"longue durée\" approach emphasizes:", options: ['Individual leaders\' decisions', 'Short-term political events', 'Slow-moving structural forces over centuries', 'Military strategies'], correctIndex: 2, concept: 'Historiography' },
    },
  },
  geography: {
    elementary: {
      easy: { text: 'Which is the largest ocean?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctIndex: 3, concept: 'World geography' },
      medium: { text: 'Which continent is the Sahara Desert located on?', options: ['Asia', 'Africa', 'Australia', 'South America'], correctIndex: 1, concept: 'Physical geography' },
      hard: { text: "A map's legend explains symbols used. What does a map's scale tell you?", options: ['The direction of north', 'The map\'s age', 'The real-world distance', 'The elevation'], correctIndex: 2, concept: 'Map reading' },
    },
    middleschool: {
      easy: { text: 'Lines of latitude run in which direction on a map?', options: ['North-South', 'East-West', 'Diagonally', 'In circles around poles'], correctIndex: 1, concept: 'Map coordinates' },
      medium: { text: 'Which climate zone is found near the equator?', options: ['Polar', 'Temperate', 'Tropical', 'Arid'], correctIndex: 2, concept: 'Climate zones' },
      hard: { text: 'A country has a young population pyramid. What does this suggest about its future?', options: ['Declining workforce', 'Rapid population growth', 'High elderly population', 'Low birth rate'], correctIndex: 1, concept: 'Population geography' },
    },
    highschool: {
      easy: { text: 'The Ring of Fire is associated with:', options: ['Deserts', 'Volcanoes and earthquakes', 'Ocean trenches only', 'Forest fires'], correctIndex: 1, concept: 'Tectonic activity' },
      medium: { text: 'Urbanization is best defined as:', options: ['Building farms outside cities', 'People moving from rural to urban areas', 'City boundaries shrinking', 'Population decline'], correctIndex: 1, concept: 'Urbanization' },
      hard: { text: 'Gentrification most directly results in:', options: ['Industrial growth', 'Displacement of lower-income residents', 'Rural development', 'Decreased property values'], correctIndex: 1, concept: 'Urban geography' },
    },
    college: {
      easy: { text: 'GIS stands for:', options: ['Global Income System', 'Geographic Information System', 'Geological Index Scale', 'General Interpolation Software'], correctIndex: 1, concept: 'Geographic tools' },
      medium: { text: 'The concept of "place" in human geography emphasizes:', options: ['Absolute coordinates', 'Physical terrain only', 'Meaning and identity attached to a location', 'Political borders'], correctIndex: 2, concept: 'Human geography' },
      hard: { text: 'Wallerstein\'s world-systems theory classifies nations as core, periphery, and semi-periphery based on:', options: ['Military power', 'Cultural influence', 'Economic roles in global capitalism', 'Geographic location'], correctIndex: 2, concept: 'Political geography' },
    },
  },
  music: {
    elementary: {
      easy: { text: 'How many beats does a quarter note get in 4/4 time?', options: ['4', '2', '1', '½'], correctIndex: 2, concept: 'Note values' },
      medium: { text: 'Which family of instruments uses a bow to produce sound?', options: ['Woodwinds', 'Brass', 'Strings', 'Percussion'], correctIndex: 2, concept: 'Instrument families' },
      hard: { text: 'A song repeats its opening section at the end (ABA form). What is this structure called?', options: ['Through-composed', 'Rondo', 'Ternary form', 'Binary form'], correctIndex: 2, concept: 'Musical form' },
    },
    middleschool: {
      easy: { text: 'How many sharps are in the key of G major?', options: ['0', '1', '2', '3'], correctIndex: 1, concept: 'Key signatures' },
      medium: { text: 'A minor scale differs from a major scale primarily in its:', options: ['Tempo', 'Rhythm', '3rd, 6th, and 7th scale degrees', 'Time signature'], correctIndex: 2, concept: 'Scales' },
      hard: { text: 'A chord progression I–V–vi–IV is used in a song. In C major, what are those chords?', options: ['C–G–Am–F', 'C–F–Am–G', 'C–Em–Am–F', 'C–G–Em–F'], correctIndex: 0, concept: 'Chord progressions' },
    },
    highschool: {
      easy: { text: 'Which period did Bach and Handel compose in?', options: ['Classical', 'Romantic', 'Baroque', 'Modern'], correctIndex: 2, concept: 'Music history' },
      medium: { text: 'Counterpoint refers to:', options: ['Loud and soft dynamics', 'Two or more independent melodic lines played simultaneously', 'A single melody with chords', 'Rhythmic variation'], correctIndex: 1, concept: 'Counterpoint' },
      hard: { text: 'A Neapolitan chord (♭II) in C minor is built on which note?', options: ['D♭', 'A♭', 'E♭', 'G'], correctIndex: 0, concept: 'Harmony & chord theory' },
    },
    college: {
      easy: { text: 'Serialism, developed by Schoenberg, organizes music using:', options: ['Major and minor scales', 'A tone row of all 12 pitches', 'Pentatonic scales', 'Modal patterns'], correctIndex: 1, concept: 'Modern composition' },
      medium: { text: 'In sonata form, the "development" section primarily does what?', options: ['Introduces the main themes', 'Returns to the tonic key', 'Manipulates and transforms earlier themes', 'Provides a coda'], correctIndex: 2, concept: 'Sonata form' },
      hard: { text: 'Heinrich Schenker\'s analytical method focuses on identifying what underlying structure in tonal music?', options: ['Surface melodic motives', 'Rhythmic cells', 'The Ursatz (fundamental structure)', 'Orchestration patterns'], correctIndex: 2, concept: 'Music analysis' },
    },
  },
  religious: {
    elementary: {
      easy: { text: 'Which book is considered sacred in Christianity?', options: ['The Quran', 'The Torah', 'The Bible', 'The Vedas'], correctIndex: 2, concept: 'Sacred texts' },
      medium: { text: 'In which religion is Diwali, the festival of lights, celebrated?', options: ['Buddhism', 'Islam', 'Christianity', 'Hinduism'], correctIndex: 3, concept: 'Religious celebrations' },
      hard: { text: 'Judaism, Christianity, and Islam all trace their origins back to which figure?', options: ['Moses', 'Abraham', 'Jesus', 'Muhammad'], correctIndex: 1, concept: 'Abrahamic religions' },
    },
    middleschool: {
      easy: { text: 'What is the holy city for Muslims, Christians, and Jews?', options: ['Mecca', 'Rome', 'Jerusalem', 'Varanasi'], correctIndex: 2, concept: 'Holy sites' },
      medium: { text: 'The Four Noble Truths are central to which religion?', options: ['Hinduism', 'Buddhism', 'Sikhism', 'Jainism'], correctIndex: 1, concept: 'Buddhist doctrine' },
      hard: { text: 'The concept of "dharma" appears in both Hinduism and Buddhism but means slightly different things. In Hinduism, dharma primarily refers to:', options: ['Enlightenment', 'Karma and rebirth', 'One\'s duty and righteous conduct', 'Sacred scripture'], correctIndex: 2, concept: 'Comparative religion' },
    },
    highschool: {
      easy: { text: 'The Five Pillars of Islam include Salah (prayer) and Zakat (charity). How many pillars are there in total?', options: ['3', '4', '5', '6'], correctIndex: 2, concept: 'Islamic practice' },
      medium: { text: 'Protestant Christianity emerged primarily as a result of:', options: ['The Crusades', 'The Protestant Reformation of the 16th century', 'The Council of Nicaea', 'The Great Schism'], correctIndex: 1, concept: 'Reformation history' },
      hard: { text: 'Liberation theology, which emerged in Latin America in the 1960s, combined Christian doctrine with:', options: ['Eastern mysticism', 'Marxist social analysis', 'Protestant evangelism', 'Islamic jurisprudence'], correctIndex: 1, concept: 'Modern religious movements' },
    },
    college: {
      easy: { text: 'Which philosopher argued that religion is "the opium of the people"?', options: ['Nietzsche', 'Freud', 'Marx', 'Durkheim'], correctIndex: 2, concept: 'Philosophy of religion' },
      medium: { text: 'Rudolf Otto\'s concept of the "numinous" describes:', options: ['Ethical religious duty', 'The rational proof of God', 'The awe-inspiring mystery of the sacred', 'Scriptural interpretation'], correctIndex: 2, concept: 'Religious experience' },
      hard: { text: 'In Émile Durkheim\'s theory, religion\'s primary social function is to:', options: ['Explain natural phenomena', 'Reinforce social cohesion and collective identity', 'Provide individual salvation', 'Justify political authority'], correctIndex: 1, concept: 'Sociology of religion' },
    },
  },
};

const FALLBACK_SUBJECT = 'math';
const FALLBACK_GRADE = 'highschool';

function getGradeGroup(grade: string | undefined): string {
  if (!grade) return FALLBACK_GRADE;
  if (grade === 'elementary') return 'elementary';
  if (grade === 'middleschool') return 'middleschool';
  if (grade === 'highschool') return 'highschool';
  return 'college';
}

function getQuestions(subject: string, grade: string): Question[] {
  const subjectKey = QUESTION_BANK[subject] ? subject : FALLBACK_SUBJECT;
  const gradeKey = getGradeGroup(grade);
  const set = QUESTION_BANK[subjectKey][gradeKey];
  return [set.easy, set.medium, set.hard];
}

export default function MicroQuizScreen() {
  const insets = useSafeAreaInsets();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjectLabel, setSubjectLabel] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackPageViewed('onboarding_micro_quiz');
    getOnboarding().then((data) => {
      const subject = data.subjects?.[0] ?? FALLBACK_SUBJECT;
      const grade = data.grade_level ?? FALLBACK_GRADE;
      setSubjectLabel(subject.charAt(0).toUpperCase() + subject.slice(1));
      setQuestions(getQuestions(subject, grade));
      setLoading(false);
    });
  }, []);

  const advance = (isCorrect: boolean) => {
    const nextAnswers = [...answers, isCorrect];
    if (currentQ === 2) {
      const score = Math.round((nextAnswers.filter(Boolean).length / 3) * 100);
      const wrongIdx = nextAnswers.findIndex((a) => !a);
      const weakConcept = wrongIdx !== -1 ? questions[wrongIdx].concept : questions[2].concept;
      router.replace(`/quiz-results?score=${score}&weak=${encodeURIComponent(weakConcept)}`);
    } else {
      setAnswers(nextAnswers);
      setCurrentQ(currentQ + 1);
      setSelected(null);
    }
  };

  const handleNext = () => {
    if (selected === null) return;
    advance(selected === questions[currentQ].correctIndex);
  };

  const handleSkip = () => advance(false);

  if (loading || questions.length === 0) return null;

  const q = questions[currentQ];
  const isLast = currentQ === 2;

  return (
    <OnboardingView>
      <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.dotsRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, i <= currentQ && styles.dotActive]} />
            ))}
          </View>

          <Text style={styles.subtitle}>{subjectLabel} Quiz</Text>
          <Text style={styles.title}>Quick Knowledge Check</Text>

          <View style={styles.card}>
            <Text style={styles.questionLabel}>Question {currentQ + 1} of 3</Text>
            <Text style={styles.questionText}>{q.text}</Text>
          </View>

          <View style={styles.optionsWrap}>
            {q.options.map((opt, i) => (
              <Pressable
                key={i}
                style={[styles.option, selected === i && styles.optionSelected]}
                onPress={() => setSelected(i)}
              >
                <View style={[styles.optionBullet, selected === i && styles.optionBulletSelected]}>
                  <Text style={[styles.optionBulletText, selected === i && styles.optionBulletTextSelected]}>
                    {String.fromCharCode(65 + i)}
                  </Text>
                </View>
                <Text style={[styles.optionText, selected === i && styles.optionTextSelected]}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.ctaWrap}>
          <Pressable style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipText}>I'm not sure</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, selected === null && styles.btnDisabled]}
            onPress={handleNext}
            disabled={selected === null}
          >
            <Text style={styles.btnText}>{isLast ? 'See My Results' : 'Next Question'}</Text>
          </Pressable>
        </View>
      </View>
      </LinearGradient>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: 24 },
  container: { flexGrow: 1 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: scaleSize(10), marginBottom: scaleSize(20) },
  dot: { width: scaleSize(10), height: scaleSize(10), borderRadius: scaleSize(5), backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#7c3aed' },
  subtitle: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(14), color: '#555', textAlign: 'center', marginBottom: scaleSize(4) },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: IS_IPAD ? 34 : RESPONSIVE.titleSmall, color: '#000', textAlign: 'center', marginBottom: scaleSize(24) },
  card: {
    backgroundColor: '#fff',
    borderRadius: scaleSize(IS_IPAD ? 14 : 16),
    padding: scaleSize(IS_IPAD ? 16 : 20),
    marginBottom: scaleSize(IS_IPAD ? 12 : 16),
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  questionLabel: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(IS_IPAD ? 12 : 13), color: '#7c3aed', marginBottom: scaleSize(IS_IPAD ? 6 : 8) },
  questionText: { fontFamily: 'FredokaOne_400Regular', fontSize: scaleFont(IS_IPAD ? 16 : 18), color: '#111', lineHeight: scaleFont(IS_IPAD ? 24 : 26) },
  optionsWrap: { gap: scaleSize(IS_IPAD ? 8 : 10), marginBottom: scaleSize(IS_IPAD ? 16 : 24) },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: scaleSize(IS_IPAD ? 10 : 12),
    padding: scaleSize(IS_IPAD ? 12 : 14),
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  optionSelected: { borderColor: '#7c3aed', borderWidth: 2, backgroundColor: '#f5f0ff' },
  optionBullet: {
    width: scaleSize(IS_IPAD ? 24 : 28),
    height: scaleSize(IS_IPAD ? 24 : 28),
    borderRadius: scaleSize(IS_IPAD ? 12 : 14),
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scaleSize(IS_IPAD ? 10 : 12),
  },
  optionBulletSelected: { backgroundColor: '#7c3aed' },
  optionBulletText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(IS_IPAD ? 13 : 14), color: '#666' },
  optionBulletTextSelected: { color: '#fff' },
  optionText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(IS_IPAD ? 14 : 15), color: '#222', flex: 1 },
  optionTextSelected: { color: '#4a1d96' },
  ctaWrap: { gap: scaleSize(8), marginBottom: -34 },
  skipBtn: { alignItems: 'center', paddingVertical: scaleSize(10) },
  skipText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(15),
    color: 'rgba(0,0,0,0.45)',
    textDecorationLine: 'none',
  },
  btn: {
    backgroundColor: '#FD8A8A',
    borderRadius: 35,
    paddingVertical: IS_IPAD ? 14 : 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    shadowColor: '#333333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: 'Fredoka_400Regular', fontSize: IS_IPAD ? 22 : RESPONSIVE.button, color: '#fff' },
});
