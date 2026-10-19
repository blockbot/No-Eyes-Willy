# Cutover checklist (not executed)

Nothing here has been done. The old public deployment, if any, is untouched. Only the owner of the hosting should run it.

1. [ ] Confirm who hosts the current public version and where it is served from (the legacy code expects `/games/noeyeswilly/`).
2. [ ] Merge the PR. The tag `legacy-phaser2-final` stays as the rollback point.
3. [ ] Create or choose the Vercel project for this repository. `vercel.json` sets the Vite framework, `npm ci`, `npm run build` and the output `dist`. Use Node 22.x.
4. [ ] Deploy a preview. Open it on a desktop browser and on a real iPhone and an Android phone. Play level 1 (route in `routes/level-1.json`), check sound after the first tap, Mute, Pause, rotation, switching apps, and a slow connection.
5. [ ] Decide the URL layout. At the domain root nothing needs changing. Under `/games/noeyeswilly/` serve `dist/` there, or keep the legacy path as a redirect to the new location. Both work because assets are relative.
6. [ ] Check cache headers on the preview: `/assets/*` immutable, `/game/*` and `index.html` revalidated.
7. [ ] Point the production domain or path at the new deployment.
8. [ ] Check the live URL: loads without console errors, level 1 can be completed, the old URL does not 404.
9. [ ] Rollback if needed: re-point at the previous deployment, or revert the merge commit. To rebuild the old game, `git checkout legacy-phaser2-final`.
