// Local preview is the editing workspace; hosted copies are for viewing.
export function isLocalWorkspace(location) {
 const host=location.hostname.toLowerCase();
 return location.protocol==='file:' || host==='localhost' || host.endsWith('.localhost') || host==='[::1]' || host==='::1' || /^127\./.test(host) || host.endsWith('.local') || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}
export function viewingSettings(location,seed,config) {
 if(seed)return seed.share || {mode:'view',light:config.light,snow:config.snow,architecture:config.architecture};
 return isLocalWorkspace(location)?null:{mode:'view',hosted:true,light:config.light,snow:config.snow,architecture:config.architecture};
}
