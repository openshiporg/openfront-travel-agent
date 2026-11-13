import {list} from '@keystone-6/core';
import {checkbox,relationship,text} from '@keystone-6/core/fields';
import {isSignedIn,permissions,permissionNames} from '../access';
import {trackingFields} from './trackingFields';
export const Role=list({
 access:{operation:{query:isSignedIn,create:permissions.canManageRoles,update:permissions.canManageRoles,delete:permissions.canManageRoles}},
 ui:{hideCreate:(args:any)=>!permissions.canManageRoles(args)},
 fields:{name:text({validation:{isRequired:true}}),...Object.fromEntries(permissionNames.map(name=>[name,checkbox({defaultValue:false})])),assignedTo:relationship({ref:'User.role',many:true}),...trackingFields},
});
