import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

    try {

        // 🔹 PARSEAR BODY (FIX VERCEL)
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

            console.log("BODY:", body);

            const { title, start_time, end_time, user_id } = body;

            if (!title || !start_time || !end_time || !user_id) {
                return res.status(400).json({ success: false, message: "Datos incompletos" });
            }

            const { data: activity, error } = await supabase
                .from('activities')
                .insert([{
                    title,
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

            return res.json({ success: true, activity });
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