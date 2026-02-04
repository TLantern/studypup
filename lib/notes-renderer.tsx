import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const noteStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  h2: { fontFamily: 'Fredoka_400Regular', fontSize: 20, color: '#333', marginBottom: 12, marginTop: 4 },
  h3: { fontFamily: 'Fredoka_400Regular', fontSize: 17, color: '#333', marginBottom: 8, marginTop: 16 },
  paragraph: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: '#444', lineHeight: 24, marginBottom: 12 },
  bullet: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 4, marginLeft: 4 },
  subBullet: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 2, marginLeft: 16 },
  bold: { fontWeight: '600' as const },
  spacer: { height: 8 },
});

function parseBold(text: string, keyPrefix: string): ReactNode {
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const start = remaining.indexOf('**');
    if (start === -1) {
      parts.push(<Text key={`${keyPrefix}-${key++}`}>{remaining}</Text>);
      break;
    }
    if (start > 0) parts.push(<Text key={`${keyPrefix}-${key++}`}>{remaining.slice(0, start)}</Text>);
    const end = remaining.indexOf('**', start + 2);
    if (end === -1) {
      parts.push(<Text key={`${keyPrefix}-${key++}`}>{remaining.slice(start + 2)}</Text>);
      break;
    }
    parts.push(<Text key={`${keyPrefix}-${key++}`} style={noteStyles.bold}>{remaining.slice(start + 2, end)}</Text>);
    remaining = remaining.slice(end + 2);
  }
  return <Text>{parts}</Text>;
}

export function parseMarkdown(md: string): ReactNode[] {
  const lines = md.split('\n');
  const nodes: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('## ')) {
      nodes.push(<Text key={i} style={noteStyles.h2}>{trimmed.slice(3)}</Text>);
    } else if (trimmed.startsWith('### ')) {
      nodes.push(<Text key={i} style={noteStyles.h3}>{trimmed.slice(4)}</Text>);
    } else if (trimmed.startsWith('- ')) {
      nodes.push(<Text key={i} style={noteStyles.bullet}>• {parseBold(trimmed.slice(2), `b-${i}`)}</Text>);
    } else if (/^\d+\.\s/.test(trimmed)) {
      nodes.push(<Text key={i} style={noteStyles.bullet}>{trimmed}</Text>);
    } else if (trimmed.startsWith('  - ')) {
      nodes.push(<Text key={i} style={noteStyles.subBullet}>• {trimmed.slice(4)}</Text>);
    } else if (trimmed) {
      nodes.push(<Text key={i} style={noteStyles.paragraph}>{parseBold(trimmed, `p-${i}`)}</Text>);
    } else {
      nodes.push(<View key={i} style={noteStyles.spacer} />);
    }
  }
  return nodes;
}
