export class PHQRParser {
    static extract(payload: string) {
        const root = this.tokenize(payload);
        const tag27Raw = root['27'] || "";
        const tag27Parsed = this.tokenize(tag27Raw);

        const bic = tag27Parsed['01'] || "";
        let account = "";

        // GoTyme and UnionBank store the real account in Sub-tag 04 
        // which is nested inside Tag 27
        if (tag27Parsed['04']) {
            account = tag27Parsed['04'];
        }
        // GCash and others use Sub-tag 02 or a specific suffix
        else if (tag27Parsed['02']) {
            const raw02 = tag27Parsed['02'];
            // If it's the long GCash string, grab the DWQM part
            account = raw02.includes('DWQM') ? raw02.substring(raw02.indexOf('DWQM')) : raw02;
        }

        return {
            bank: this.getBankName(bic),
            accountNumber: account,
            receiver: root['59']
        };
    }

    static tokenize(str: string) {
        let i = 0;
        const result: { [key: string]: string } = {};
        while (i < str.length) {
            const tag = str.substring(i, i + 2);
            const len = parseInt(str.substring(i + 2, i + 4), 10);
            if (isNaN(len)) break; // Safety break
            const val = str.substring(i + 4, i + 4 + len);
            result[tag] = val;
            i += 4 + len;
        }
        return result;
    }

    static getBankName(bic: string) {
        const banks: { [key: string]: string } = {
            'GXCHPHM2XXX': 'GCash',
            'UBPHPHMMXXX': 'UnionBank',
            'GOTYPHM2XXX': 'GoTyme',
            "BOPIPHMMXXX": "BPI",
            "PAPHPHM1XXX": "Maya"
        };
        return banks[bic] || bic;
    }
}