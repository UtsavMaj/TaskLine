import { useColorScheme } from 'react-native';

/** Same palette as the web app: paper, ink and one terracotta accent. */
const light = {
  bg: '#F4F1EA',
  surface: '#FBFAF6',
  sunk: '#ECE8DF',
  line: '#DDD7CA',
  lineStrong: '#C9C1B1',
  ink: '#1E1C18',
  ink2: '#57524A',
  ink3: '#8A8478',
  accent: '#C8552B',
  accentSoft: '#F5E1D6',
  onAccent: '#FFFAF5',
  olive: '#55703C',
  oliveSoft: '#E3EAD8',
  ochre: '#A87613',
  ochreSoft: '#F3E7CB',
  stone: '#6F6A60',
  stoneSoft: '#E6E2D9',
  brick: '#A8382C',
  brickSoft: '#F4DCD7',
};

const dark: typeof light = {
  bg: '#151412',
  surface: '#1D1C19',
  sunk: '#24221E',
  line: '#34312B',
  lineStrong: '#4A463E',
  ink: '#EEE9DF',
  ink2: '#B9B2A5',
  ink3: '#857E72',
  accent: '#E06A3C',
  accentSoft: '#3A241A',
  onAccent: '#1A0E08',
  olive: '#9CBB78',
  oliveSoft: '#263020',
  ochre: '#DCAE52',
  ochreSoft: '#352B16',
  stone: '#AAA396',
  stoneSoft: '#2B2925',
  brick: '#E4796B',
  brickSoft: '#3A201C',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark() {
  return useColorScheme() === 'dark';
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14 } as const;

export const type = {
  title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.6 },
  heading: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
  label: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const },
};
