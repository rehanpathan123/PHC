import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { phcsApi, inventoryApi } from '../services/api';
import { Select, Card, CardHeader, CardBody, Badge, LoadingSpinner } from '../components/ui';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function makeIcon(color) {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

const blueIcon  = makeIcon('blue');
const greenIcon = makeIcon('green');
const redIcon   = makeIcon('red');

export default function MapPage() {
  const [phcs, setPhcs] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [selectedMed, setSelectedMed] = useState('');
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentPhcId, setCurrentPhcId] = useState(1);

  useEffect(() => {
    Promise.all([phcsApi.list(), inventoryApi.getAllMedicines()]).then(([p, m]) => {
      setPhcs(p);
      setMedicines(m);
      if (m.length) setSelectedMed(String(m[0].id));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMed || !phcs.length) return;
    inventoryApi.availability(selectedMed, currentPhcId).then(data => {
      const map = {};
      data.nearby_phcs?.forEach(p => { map[p.id] = p; });
      // Current PHC
      map[currentPhcId] = {
        id: currentPhcId,
        available_quantity: data.current_quantity,
        status: data.current_phc_available ? 'AVAILABLE' : 'OUT_OF_STOCK',
        isCurrent: true,
      };
      setAvailability(map);
    }).catch(() => {});
  }, [selectedMed, currentPhcId, phcs]);

  if (loading) return <LoadingSpinner />;

  const center = phcs.length
    ? [phcs[Math.floor(phcs.length / 2)].latitude, phcs[Math.floor(phcs.length / 2)].longitude]
    : [22.75, 72.68];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <MapPin className="w-6 h-6 text-brand" />
        <h1 className="text-xl font-bold font-display">Nearby PHC Map</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-4 items-end">
            <Select
              label="Current PHC"
              value={currentPhcId}
              onChange={e => setCurrentPhcId(Number(e.target.value))}
              className="w-48"
            >
              {phcs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select
              label="Show stock for"
              value={selectedMed}
              onChange={e => setSelectedMed(e.target.value)}
              className="w-52"
            >
              {medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Current PHC</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Available</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Out of Stock</span>
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <MapContainer
            center={center}
            zoom={12}
            className="w-full rounded-b-xl"
            style={{ height: '480px' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {phcs.map(phc => {
              const avail = availability[phc.id];
              const isCurrent = phc.id === currentPhcId;
              const icon = isCurrent ? blueIcon
                : !avail ? blueIcon
                : avail.status === 'AVAILABLE' ? greenIcon
                : redIcon;
              return (
                <Marker key={phc.id} position={[phc.latitude, phc.longitude]} icon={icon}>
                  <Popup>
                    <div className="min-w-48">
                      <p className="font-bold text-gray-900">{phc.name} {isCurrent && '(Current)'}</p>
                      <p className="text-xs text-gray-500 mb-2">{phc.address}</p>
                      {avail && (
                        <>
                          <p className="text-sm font-medium">
                            {medicines.find(m => m.id === Number(selectedMed))?.name}:
                          </p>
                          <p className={`text-sm font-bold ${avail.status === 'AVAILABLE' ? 'text-green-700' : 'text-red-700'}`}>
                            {avail.status} {avail.available_quantity !== undefined ? `— ${avail.available_quantity} units` : ''}
                          </p>
                          {avail.distance_km && (
                            <p className="text-xs text-gray-500 mt-1">📍 {avail.distance_km} km away</p>
                          )}
                        </>
                      )}
                      <p className="text-xs text-gray-400 mt-2">📞 {phc.contact}</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </CardBody>
      </Card>

      {/* PHC List */}
      <Card>
        <CardHeader><p className="font-semibold text-gray-800">All PHCs</p></CardHeader>
        <div className="divide-y divide-gray-100">
          {phcs.map(phc => {
            const avail = availability[phc.id];
            const isCurrent = phc.id === currentPhcId;
            return (
              <div key={phc.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="font-semibold text-sm text-gray-900">
                    {phc.name}
                    {isCurrent && <span className="ml-2 text-xs bg-brand-muted text-brand px-2 py-0.5 rounded-full">Current</span>}
                  </p>
                  <p className="text-xs text-gray-500">{phc.address}</p>
                  {avail?.distance_km && <p className="text-xs text-gray-400">📍 {avail.distance_km} km</p>}
                </div>
                <div className="text-right">
                  {avail ? (
                    <>
                      <Badge variant={avail.status}>{avail.status?.replace('_', ' ')}</Badge>
                      {avail.available_quantity !== undefined && (
                        <p className="text-xs text-gray-500 mt-1">{avail.available_quantity} units</p>
                      )}
                    </>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
