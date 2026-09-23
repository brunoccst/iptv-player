import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { appConfig } from './config';

export function App() {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Text style={styles.title}>{appConfig.appName}</Text>
      <Pressable
        hasTVPreferredFocus
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.button, focused && styles.buttonFocused]}
      >
        <Text style={styles.buttonText}>TV app scaffold</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141414',
  },
  title: {
    color: '#e50914',
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 32,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#2a2a2a',
  },
  buttonFocused: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.08 }],
  },
  buttonText: {
    color: '#e5e5e5',
    fontSize: 24,
  },
});
