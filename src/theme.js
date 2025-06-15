import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  colors: {
    gameColors: {
      correct: '#4CAF50',      // Green for correct guess
      veryClose: '#FF5252',    // Dark red for very close
      close: '#FF7B7B',        // Red for close
      far: '#FFB74D',          // Orange for far
      veryFar: '#FFEB3B',      // Yellow for very far
    },
  },
  styles: {
    global: {
      body: {
        bg: 'gray.50',
      },
    },
  },
});

export default theme; 