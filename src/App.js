import React from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import GeoGlobeGame from './components/GeoGlobeGame';
import theme from './theme';

function App() {
  return (
    <ChakraProvider theme={theme}>
      <GeoGlobeGame />
    </ChakraProvider>
  );
}

export default App;
