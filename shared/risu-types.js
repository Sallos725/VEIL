/**
 * Minimal RisuAI plugin API surface used by VEIL.
 * @typedef {object} RisuaiPluginApi
 * @property {() => Promise<number>} [getCurrentCharacterIndex]
 * @property {() => Promise<number>} [getCurrentChatIndex]
 * @property {(index: number) => Promise<object|null>} [getCharacterFromIndex]
 * @property {(charIndex: number, chatIndex: number) => Promise<object|null>} [getChatFromIndex]
 * @property {() => Promise<object|null>} [getCharacter]
 * @property {(scopes: string[]) => Promise<object|null>} [getDatabase]
 * @property {() => Promise<object>} [getLocalPluginStorage]
 * @property {(name: string) => Promise<string>} [getArgument]
 * @property {(meta: object, tools: () => Promise<object[]>, handler: Function) => Promise<void>} [registerMCP]
 * @property {(config: object, handler: Function) => Promise<object>} [registerButton]
 * @property {(mode: string) => Promise<void>} [showContainer]
 * @property {() => Promise<void>} [hideContainer]
 * @property {(fn: Function) => void} [registerPluginUnload]
 * @property {(id: string) => Promise<void>} [unregisterUIPart]
 */

export {};
