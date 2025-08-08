/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_ADOBE_CLIENT_ID: string
    readonly VITE_BUCKET: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
} 