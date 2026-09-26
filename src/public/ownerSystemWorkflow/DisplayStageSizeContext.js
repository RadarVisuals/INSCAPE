import { createContext } from 'react';

// The Display owns the physical-pixel Stage dimensions. screenScale converts
// them to screen CSS pixels; contentScale converts authored UI lengths into
// this surface. Consumers receive all three in the same frame resize commit.
export const DisplayStageSizeContext = createContext(null);
