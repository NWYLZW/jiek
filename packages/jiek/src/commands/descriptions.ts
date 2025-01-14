export const entriesDescription = `
Specify the build entry-points of the package.json's 'exports' field.
Support glob pattern and array.
.e.g. '.', './*', './sub/*', './a,./b'.
`.trim()

export const filtersDescription = `
Filter the packages from the workspace.
Support fuzzy match and array.
.e.g. 'core,utils'.
`.trim()

export const outdirDescription = `
The output directory of the build, which relative to the target subpackage root directory.
Support with variables: 'PKG_NAME',
.e.g. 'dist/{{PKG_NAME}}'.
`.trim()
