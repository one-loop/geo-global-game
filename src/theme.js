import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  colors: {
    gameColors: {
      correct: '#4CAF50',      // Green for correct guess
      veryClose: '#FF5252',    // Dark red for very close
      close: '#FF7B7B',        // Red for close
      far: '#FFB74D',          // Orange for far
      veryFar: '#FFEB3B',      // Yellow for very far
    },
    brand: {
      50: '#E3F2FD',
      100: '#BBDEFB',
      200: '#90CAF9',
      300: '#64B5F6',
      400: '#42A5F5',
      500: '#2196F3',
      600: '#1E88E5',
      700: '#1976D2',
      800: '#1565C0',
      900: '#0D47A1',
    }
  },
  styles: {
    global: {
      body: {
        bg: '#000',
        color: 'white',
      }
    }
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: 'xl',
        fontWeight: 'medium',
      },
      variants: {
        solid: {
          bg: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          _hover: {
            bg: 'rgba(255, 255, 255, 0.15)',
          },
          _active: {
            bg: 'rgba(255, 255, 255, 0.2)',
          }
        }
      }
    },
    Input: {
      variants: {
        filled: {
          field: {
            bg: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: 'xl',
            _hover: {
              bg: 'rgba(255, 255, 255, 0.15)',
            },
            _focus: {
              bg: 'rgba(255, 255, 255, 0.15)',
              borderColor: 'brand.500',
            }
          }
        }
      },
      defaultProps: {
        variant: 'filled'
      }
    },
    Badge: {
      baseStyle: {
        borderRadius: 'xl',
        px: 3,
        py: 1,
      }
    }
  }
});

export default theme; 