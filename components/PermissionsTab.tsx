import React, { useState } from 'react';
import { Role, Permission } from '../App';
import { useLanguage } from './LanguageContext';

interface PermissionsTabProps {
    roles: Role[];
    permissions: Permission[];
    onAddRole: (name: string) => void;
    onDeleteRole: (id: string) => void;
    onUpdatePermission: (permissionId: string, roleName: string, hasPermission: boolean) => void;
}

const PermissionsTab: React.FC<PermissionsTabProps> = ({ roles, permissions, onAddRole, onDeleteRole, onUpdatePermission }) => {
    const { t } = useLanguage();
    const [newRoleName, setNewRoleName] = useState('');

    const permGroups = [
      {
          name: 'perm_group_tabs',
          perms: ['perm_tab_entry', 'perm_tab_tasks', 'perm_tab_bom', 'perm_tab_missing', 'perm_tab_analytics', 'perm_tab_settings', 'perm_tab_permissions']
      },
      {
          name: 'perm_group_actions',
          perms: ['perm_btn_finish', 'perm_btn_edit', 'perm_btn_delete', 'perm_btn_resolve', 'perm_btn_missing', 'perm_btn_copy', 'perm_btn_note', 'perm_btn_incorrect', 'perm_view_fullscreen', 'perm_play_sound', 'perm_push_notification', 'perm_view_passwords']
      },
      {
          name: 'perm_group_mgmt',
          perms: ['perm_manage_users', 'perm_delete_users', 'perm_manage_db', 'perm_manage_bom', 'perm_archive', 'perm_manage_breaks', 'perm_manage_roles']
      }
    ];

    const handleAddRole = (e: React.FormEvent) => {
      e.preventDefault();
      if (newRoleName.trim()) {
          onAddRole(newRoleName.trim());
          setNewRoleName('');
      }
    };
    
    const hasPermission = (roleId: string, permName: string) => {
        return permissions?.some(p => p.roleId === roleId && p.permissionName === permName) || false;
    };
    
    // Sort roles: System roles first, then custom roles alphabetically
    const sortedRoles = [...roles].sort((a, b) => {
        if (a.isSystem && !b.isSystem) return -1;
        if (!a.isSystem && b.isSystem) return 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-8 animate-fade-in">
            <h1 className="text-center text-2xl sm:text-3xl font-bold text-orange-400 mb-6 sm:mb-8">{t('sect_roles')}</h1>
            
            {permGroups.map(group => (
                 <div key={group.name} className="bg-gray-900 rounded-xl p-6 shadow-lg border border-gray-700">
                     <h3 className="text-lg font-bold text-gray-300 mb-4 border-b border-gray-700 pb-2">{t(group.name as any)}</h3>
                     <div className="overflow-x-auto">
                         <table className="min-w-full text-left text-sm border-collapse">
                             <thead>
                                 <tr className="border-b-2 border-gray-700">
                                     <th className="py-3 px-4 text-gray-400 font-semibold w-1/3">Oprávnenie</th>
                                     {sortedRoles.map(role => (
                                         <th key={role.id} className="py-3 px-4 text-white font-bold text-center">
                                             {role.name}
                                             {!role.isSystem && <button onClick={() => onDeleteRole(role.id)} className="ml-1 text-red-600 hover:text-red-400 text-xs"> (x)</button>}
                                         </th>
                                     ))}
                                 </tr>
                             </thead>
                             <tbody>
                                 {group.perms.map(perm => (
                                     <tr key={perm} className="border-b border-gray-800 hover:bg-gray-800/50">
                                         <td className="py-3 px-4 text-gray-300">{t(perm as any)}</td>
                                         {sortedRoles.map(role => (
                                             <td key={`${role.id}-${perm}`} className="py-3 px-4 text-center">
                                                 <input 
                                                     type="checkbox" 
                                                     checked={role.name === 'ADMIN' ? true : hasPermission(role.id, perm)} 
                                                     onChange={(e) => onUpdatePermission(perm, role.name, e.target.checked)}
                                                     disabled={role.name === 'ADMIN'}
                                                     className="w-5 h-5 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500 focus:ring-2" 
                                                 />
                                             </td>
                                         ))}
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                 </div>
             ))}
            
            <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-gray-700">
                 <h3 className="text-lg font-bold text-gray-300 mb-4">{t('role_add_btn')}</h3>
                 <form onSubmit={handleAddRole} className="flex gap-2 max-w-sm mt-4">
                     <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder={t('role_name_place')} className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm uppercase" />
                     <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded font-semibold">{t('role_add_btn')}</button>
                 </form>
             </div>
        </div>
    );
};

export default PermissionsTab;
