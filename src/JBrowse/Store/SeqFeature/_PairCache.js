class PairedRead {
    id() {
        return Math.min(this.read1.id(), this.read2.id())
    }
    get(field) {
        return this._get(field.toLowerCase())
    }
    _get(field) {
        if(field === 'start') {
            return Math.min(this.read1._get('start'), this.read2._get('start'))
        } else if(field === 'end') {
            return Math.max(this.read1._get('end'), this.read2._get('end'))
        } else if(field === 'name') {
            return this.read1._get('name')
        } else if(field === 'pair_orientation') {
            return this.read1._get('pair_orientation')
        } else if(field === 'template_length') {
            return this.read1._get('template_length')
        }
    }
    pairedFeature() { return true }
    children() {}
}

function canBePaired(alignment) {
    return alignment.get('multi_segment_template') &&
        !alignment.get('multi_segment_next_segment_unmapped') &&
        alignment.get('seq_id') === alignment.get('next_seq_id') &&
        (alignment.get('multi_segment_first') || alignment.get('multi_segment_last')) &&
        !(alignment.get('secondary_alignment') || alignment.get('supplementary_alignment'))
}

define( [
            'dojo/_base/declare',
            'JBrowse/Util',
        ],
        function(
            declare,
            Util,
        ) {

return declare(null, {
    constructor(args) {
        this.featureCache = {}
        this.insertUpperPercentile = args.insertUpperPercentile || 0.95
        this.insertLowerPercentile = args.insertLowerPercentile || 0.05
        this.insertStatsCacheMin = args.insertStatsCacheMin || 400
        this.insertMaxSize = args.insertMaxSize || 50000
        this.orientationType = args.orientationType || 'fr'
    },


    // called by getFeatures from the DeferredFeaturesMixin
    pairFeatures(query, records, featCallback, endCallback, errorCallback, featTransform) {
        const pairCache = {};
        for(let i = 0; i < records.length; i++) {
            let feat
            if (canBePaired(records[i])) {
                let name = records[i]._get('name')
                feat = pairCache[name]
                if (feat) {
                    if(records[i].get('multi_segment_first')) {
                        feat.read1 = records[i]
                    } else if(records[i].get('multi_segment_last')) {
                        feat.read2 = records[i]
                    } else {
                        console.log('unable to pair read',records[i])
                    }
                    if(feat.read1 && feat.read2) {
                        delete pairCache[name]
                        if(this.insertMaxSize > feat.get('end') - feat.get('start')) {
                             this.featureCache[name] = feat
                        }
                    }
                }
                else {
                    feat = new PairedRead()
                    if(records[i].get('multi_segment_first')) {
                        feat.read1 = records[i]
                    } else if(records[i].get('multi_segment_last')) {
                        feat.read2 = records[i]
                    } else {
                        console.log('unable to pair read', records[i])
                    }
                    pairCache[name] = feat
                }
            }
            else if(!(records[i]._get('end') < query.start) && !(records[i]._get('start') > query.end)){
                let feat = records[i]
                featCallback(feat)
            }
        }
        Object.entries(this.featureCache).forEach(([k, v]) => {
            if(v._get('end') > query.start && v._get('start') < query.end) {
                featCallback(v)
            }
        })
    },


    cleanFeatureCache(query) {
        Object.entries(this.featureCache).forEach(([k, v]) => {
            if((v._get('end') < query.start) || (v._get('start') > query.end)) {
                delete this.featureCache[k]
            }
        })
    },

    getStatsForPairCache() {
        if(Object.keys(this.featureCache).length > this.insertStatsCacheMin) {
            var total = Object.keys(this.featureCache).length
            var tlens = Object.entries(this.featureCache)
                .map(([k, v]) => Math.abs(v.get('template_length')))
                .filter(tlen => tlen < this.insertMaxSize)
                .sort((a, b) => a - b)
            var sum = tlens.reduce((a, b) => a + b, 0)
            var sum2 = tlens.map(a => a*a).reduce((a, b) => a + b, 0)
            var avg = sum / total;
            var sd = Math.sqrt((total * sum2 - sum*sum) / (total * total));
            return {
                upper: avg + 3*sd,
                lower: avg - 3*sd
            }
        }
        return { upper: Infinity, lower: 0 }
    }
});
});
