# INSCAPE UI Notes

Status: historical prototype feedback retained as design evidence

These notes record observations made while earlier prototypes were being evaluated. Current product direction is the permanent 3 x 3 lattice of nine freely authored tables defined by `docs/INSCAPE_CANVAS_LATTICE.md` and `INSCAPE_FINAL_UI_MIGRATION_HANDOFF.md`. References below to an “official gallery,” earlier table counts, or prototype-specific layouts are historical context, not current Alpha architecture. Historical persisted Gallery, Upper World, and five-table workspace-v8 data is **LEGACY COMPATIBILITY INPUT — NOT THE TARGET MODEL.**


inside the /prototype/workspace-rail where we are building the final look of inscape there is couple things to add / fix:

- when opening an nft and viewing the full view the dossier that slides out and displays the metadata, there is or can only be 1 side displayed at a time. it cant display both at the same time, which it should be able to

- when having the metadata dossiers open i cannot scroll or swipe to the next image, this should also be the case, with the metadata data open (whatever side or both at the same time) it should be possible to sroll or swipe to the next one with the metadata still open.

- I dont like the big px border around the nfts. im not talking about the top and bottom taskbars but the border that surrounds everything. replace this with just 1px border all around.

- there is an issue with resizing. when grabbing the right bottom corner, the image resizes in a symmetrical way, that means when i resize from the bottom right all of the four borders do the same at the same time. draggin right corner lower should only expand in that direction. also, all 4 corners should be dragable not just 1.
the styling of that corner to grab is also ugly, I suggest you remove that hinge and just have it display the resize cursor internally.

- displaying transparent assets currently shows a black border in the prototype, i think placing an artwork in the official gallery for example does not do this. when migrating this should also work the same way > when asset is saved on a transparent background it should remain transparent.

- the current top taskbar and bottom task bar (the white ones) that encases the nfts should become a framestyle when migrating, this way people can place artwork and nfts without these bars. when i go to the 02 / collections table > "curated sets" those images have a black bar in the bottom. I like that black bottom bar, it also contains information. this one should also become a "frame" in the official version

- inside the prototype in the middle of each "table" there is a 3 collumn "preview" of a window containing the words "index" or "curated local files" for example. make sure this doesnt make it in the official version when we will migrate.

- each table has some information in the top / middle of the screen,  I actually like this text but im not sure what it is reffering to. tables should ideally be designed by the owner freely so it should probably also be able to be renamed by them as they wish.
maybe even decide where to place it exactly.

- the keeper symbol in the far bottom right, the one you click to make him dock or set free again can be larger, make it 3 times its current size.

- the prototype displays some coordinates on the left and right side of the viewport. Y0 and X0, replace them with clickable chevrons. also add these to top and bottom if applicable.

- I think the perfect amount of tables right now should be 9. while its more than what we currently have i think it will be less confusing in terms of navigation.

- the location indicator at the right side, the little squares that show you your active table, these are also clickable, which is good. this will probably become one of the main ways people will probably navigate with because it can clearly show where you are.
this needs to be larger and maybe be placed in a smarter / immediately visible location.

- placing nfts on the table right now is freely drag them and place them wherever. this is great but I think the grid we use currently in the background, this should become a snap to grid for the windows.

- resizing the nfts should also allow you to make them bigger, right now size is capped idk at what size but in any case, its too small.

- sometimes when clicking it would change table because of high sensitivity.

- also dragging / swiping is not very reliable and makes you move in a direction you dont want.
