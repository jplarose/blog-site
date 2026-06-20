# Goal
This feature should introduce a new page where the user can create a new template to be used for making a post. This should be a drag and drop template editor sandbox where the user can decide size and placement of different components such as: title, rendered rich text, image, gallery, column, etc. Once the user is satisfied with a layout they can save it with a custom name. Then, when making a new post the template will be available for them to choose from a dropdown of available templates and they will be able to decide what content to put into each of the components.

## Technology
Each of the components should be relatively simple components to keep the overhead to a minimum. We want to give the user control and flexibility on their page layout, and avoid that feeling overwhelming by having the components be easy to understand and visualize their role on the pages. 
- We can use dnd-kit as the implementation for drag and drop component editing
- We can save the templates as json in the DB to ensure consistent rendering and repeatability across multiple different posts
- We should use the existing text box component with custom markdown capabilities from ~/Dev/Dusk-Social/ui/components/rte/ and ~/Dev/Dusk-Social/ui/components/RichTextRenderer.tsx here as well to reuse the existing implementation(minus the user tagging)

## Testing
There needs to be testing implemented for this task that verifies that a saved layout is rendered the same each time it is loaded and that the rendered layout matches the layout that was saved.

## Output
- Keep note of the dotnet api backend calls we will need to create, create the stubs that will call them in this UI project and create and maintain a separate markdown document that tracks the controllers, endpoints, and dto contracts that will be required as well as what consumes them in this ui app.
