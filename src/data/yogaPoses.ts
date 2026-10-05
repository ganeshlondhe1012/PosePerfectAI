import { YogaPose } from '../types';

export const yogaPoses: YogaPose[] = [
  {
    id: 'tree', title: 'Tree Pose', difficulty: 'Beginner', duration: '5 min', category: 'Balance',
    benefits: ['Improves balance', 'Strengthens legs', 'Improves focus'],
    steps: ['Stand tall with both feet together.', 'Lift your right foot onto your left thigh.', 'Join your palms at your chest.', 'Focus on one point in front of you.', 'Hold the pose and breathe steadily.'],
    image: require('../assets/images/treePose.jpeg'),
  },
  {
    id: 'mountain', title: 'Mountain Pose', difficulty: 'Beginner', duration: '3 min', category: 'Standing',
    benefits: ['Improves posture', 'Enhances stability', 'Builds body awareness'],
    steps: ['Stand with your feet together.', 'Keep your spine straight.', 'Relax your shoulders.', 'Keep your arms by your sides.', 'Take slow, deep breaths.'],
    image: require('../assets/images/mountainPose.jpeg'),
  },
  {
    id: 'warrior2', title: 'Warrior II', difficulty: 'Intermediate', duration: '7 min', category: 'Standing',
    benefits: ['Builds strength', 'Improves endurance', 'Opens the hips'],
    steps: ['Stand with your feet wide apart.', 'Turn your front foot outward.', 'Bend your front knee.', 'Extend both arms sideways.', 'Look over your front hand.'],
    image: require('../assets/images/warrior2.jpeg'),
  },
  {
    id: 'triangle', title: 'Triangle Pose', difficulty: 'Intermediate', duration: '6 min', category: 'Stretch',
    benefits: ['Increases flexibility', 'Improves digestion', 'Strengthens core'],
    steps: ['Stand with your feet wide apart.', 'Turn one foot outward.', 'Reach forward with your hand.', 'Lower your hand toward your shin.', 'Raise your opposite arm upward.'],
    image: require('../assets/images/trianglePose.jpeg'),
  },
  {
    id: 'cobra', title: 'Cobra Pose', difficulty: 'Beginner', duration: '4 min', category: 'Stretch',
    benefits: ['Strengthens spine', 'Opens the chest', 'Improves flexibility'],
    steps: ['Lie flat on your stomach.', 'Place your palms under your shoulders.', 'Press into your hands.', 'Lift your chest gently.', 'Keep your elbows slightly bent.'],
    image: require('../assets/images/cobraPose.jpeg'),
  },
];
