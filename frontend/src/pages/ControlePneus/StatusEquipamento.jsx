import React from 'react';

// Mapeia cada status a uma cor e prioridade para ordenação
const statusConfig = {
    "Sem layout cadastrado": { color: "critical", priority: 1 },
    "Pneus com alto desgaste": { color: "critical", priority: 2 },
    "Faltando agregação": { color: "critical", priority: 3 },
    "Faltando medição": { color: "warning", priority: 4 },
    "Sem medições recentes": { color: "warning", priority: 5 },
    "OK": { color: "ok", priority: 6 },
};

function StatusEquipamento({ status }) {
    // Se o status for nulo ou indefinido, não renderiza nada
    if (!status) {
        return null;
    }

    // Divide a string de status em um array, remove espaços extras
    const statuses = status.split('|').map(s => s.trim());

    // Ordena os status com base na prioridade definida em statusConfig
    statuses.sort((a, b) => {
        const priorityA = statusConfig[a]?.priority || 99;
        const priorityB = statusConfig[b]?.priority || 99;
        return priorityA - priorityB;
    });

    return (
        <div className="status-container">
            {statuses.map((s, index) => {
                const config = statusConfig[s] || { color: "default" };
                return (
                    <span key={index} className={`status-tag status-${config.color}`}>
                        {s}
                    </span>
                );
            })}
        </div>
    );
}

export default StatusEquipamento;
