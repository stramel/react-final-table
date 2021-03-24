export declare const byTextAscending: <T extends Record<string, any>>(getTextProperty: (object: T) => string) => (objectA: T, objectB: T) => 1 | -1 | 0;
export declare const byTextDescending: <T extends Record<string, any>>(getTextProperty: (object: T) => string) => (objectA: T, objectB: T) => 1 | -1 | 0;
