import React from 'react';
import { ChakraProvider, Box } from '@chakra-ui/react';
import GeoGlobeGame from './components/GeoGlobeGame';
import theme from './theme';

function App() {
  return (
    <ChakraProvider theme={theme}>
      <Box minH="100vh" bg="gray.50">
        <GeoGlobeGame />
      </Box>
    </ChakraProvider>
  );
}

export default App;
