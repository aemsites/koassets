/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_BUCKET: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
} 