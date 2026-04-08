import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

    try {

        // ✅ PARSE BODY
        let body = req.body;
        if (typeof body === "string") {
            body = JSON.parse(body);
        }

        // 🔹 GET
        if (req.method === 'GET') {

            const { data, error } = await supabase
                .from('activities')
                .select(`
                    *,
                    users:created_by (id, username),
                    activity_assignments (
                        id,
                        people (id, name, role)
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("GET ERROR:", error);
                return res.status(500).json({ success: false, message: error.message });
            }

            return res.json(data);
        }

        // 🔹 POST
        if (req.method === 'POST') {

            const { title, description, start_time, end_time, user_id, people_names } = body;

            if (!title || !start_time || !end_time || !user_id) {
                return res.status(400).json({ success: false, message: "Datos incompletos" });
            }

            // ✅ 1. CREAR ACTIVIDAD
            const { data: activity, error } = await supabase
                .from('activities')
                .insert([{
                    title,
                    description,
                    start_time,
                    end_time,
                    status: 'pending',
                    created_by: user_id
                }])
                .select()
                .single();

            if (error) {
                console.error("POST ERROR:", error);
                return res.status(500).json({ success: false, message: error.message });
            }

            // ✅ 2. PERSONAS PRO
            if (people_names && Array.isArray(people_names) && people_names.length > 0) {

                // 🧼 limpiar + normalizar
                const normalized = [...new Set(
                    people_names
                        .map(n => n.trim())
                        .filter(n => n.length > 0)
                )];

                // 🔍 buscar existentes (case-insensitive manual)
                const { data: existingPeople, error: fetchError } = await supabase
                    .from('people')
                    .select('*');

                if (fetchError) {
                    console.error("FETCH PEOPLE ERROR:", fetchError);
                }

                const existingMap = {};
                existingPeople.forEach(p => {
                    existingMap[p.name.toLowerCase()] = p.id;
                });

                // ➕ separar nuevos
                const newPeople = normalized.filter(name =>
                    !existingMap[name.toLowerCase()]
                );

                let newIds = [];

                // 🚀 INSERT MASIVO
                if (newPeople.length > 0) {
                    const { data: inserted, error: insertError } = await supabase
                        .from('people')
                        .insert(newPeople.map(name => ({ name })))
                        .select();

                    if (insertError) {
                        console.error("INSERT ERROR:", insertError);
                    } else {
                        inserted.forEach(p => {
                            existingMap[p.name.toLowerCase()] = p.id;
                        });
                    }
                }

                // 🔗 IDs finales
                const allIds = normalized.map(name => existingMap[name.toLowerCase()]);

                // 🚀 INSERT MASIVO RELACIONES
                const assignments = allIds.map(person_id => ({
                    activity_id: activity.id,
                    person_id
                }));

                const { error: assignError } = await supabase
                    .from('activity_assignments')
                    .insert(assignments);

                if (assignError) {
                    console.error("ASSIGN ERROR:", assignError);
                    return res.status(500).json({
                        success: false,
                        message: assignError.message
                    });
                }
            }

            return res.json({ success: true, activity });
        }

                    // 🔹 PATCH (ACTUALIZAR ESTADO)
                        if (req.method === 'PATCH') {

                const { id, status, observations } = body;

                if (!id || !status) {
                    return res.status(400).json({ success: false });
                }

                const updateData = { status };

                // 👉 SOLO guardar observaciones si viene
                if (observations) {
                    updateData.observations = observations;
                }

                const { error } = await supabase
                    .from('activities')
                    .update(updateData)
                    .eq('id', id);

                if (error) {
                    console.error("UPDATE ERROR:", error);
                    return res.status(500).json({ success: false });
                }

                return res.json({ success: true });
            }

        // 🔹 DELETE
        if (req.method === 'DELETE') {

            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ success: false });
            }

            await supabase.from('activity_assignments').delete().eq('activity_id', id);
            await supabase.from('activity_logs').delete().eq('activity_id', id);
            await supabase.from('activity_history').delete().eq('activity_id', id);

            const { error } = await supabase
                .from('activities')
                .delete()
                .eq('id', id);

            if (error) {
                console.error("DELETE ERROR:", error);
                return res.status(500).json({ success: false, message: error.message });
            }

            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (err) {
        console.error("SERVER ERROR:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}