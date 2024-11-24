<p align="center">
  <img src="./jk.svg" width='256' alt='Jiek Logo'>
</p>

# Jiek (YiJie Kit)

My personal kit for building web applications.

## Sub Packages

- [jiek](./packages/jiek/README.md): A lightweight toolkit for compiling and managing libraries based on `package.json` metadata and suitable for `Monorepo`.
  - Automatic inference: Automatically infer build rules based on relevant fields in `package.json`, reducing the need for configuration files, making it more lightweight and standard-compliant
  - Build tools: Support multiple build tools, no need to struggle with using swc, esbuild, or tsc
  - Workspace-friendly: Support development paradigms in pnpm workspaces
  - Type definition files: Support aggregated generation of type definition files
  - Watch mode: Adapt to rollup's watch mode
  - Publish adaptation: Support isomorphic generation of `package.json` and other related fields
  - CommonJS: Compatible with users who are still using cjs
